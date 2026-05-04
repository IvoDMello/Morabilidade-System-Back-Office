"""
Endpoints de preferências de cliente e cálculo de matches (oportunidades).

Match = imóvel disponível que combina com a preferência ativa do cliente.
A regra é simples e roda em Python (volume baixo: ~30 imóveis × ~50 clientes).
"""
import unicodedata
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import get_current_user, require_admin
from app.database import supabase_admin
from app.schemas.oportunidade import (
    MatchClienteImovel, MatchImovelCliente, PreferenciaCreate, PreferenciaOut,
    PreferenciaUpdate,
)

router = APIRouter()

# Imóveis de venda abaixo desse valor têm alta demanda orgânica e são excluídos das oportunidades.
VALOR_MINIMO_OPORTUNIDADE = 2_000_000.0


# ── Helpers ──────────────────────────────────────────────────────────────────

def _norm(s: str) -> str:
    """Lowercase sem acentos para comparações insensíveis a grafia."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()

def _score_imovel_preferencia(pref: dict) -> int:
    """Score de compatibilidade (0-7): conta quantos critérios foram definidos na preferência.
    Preferências mais específicas produzem score maior, indicando leads mais qualificados.
    Só deve ser chamado após confirmar que o match já é válido."""
    score = 0
    if pref.get("tipo_negocio") and pref.get("tipo_negocio") != "ambos":
        score += 1
    if pref.get("tipo_imovel"):
        score += 1
    if (pref.get("cidade") or "").strip():
        score += 1
    if [b for b in (pref.get("bairros") or []) if b.strip()]:
        score += 1
    if pref.get("dormitorios_min"):  # 0 não filtra nada, não conta
        score += 1
    if pref.get("vagas_garagem_min"):
        score += 1
    if pref.get("valor_min") is not None or pref.get("valor_max") is not None:
        score += 1
    return score


def _imovel_casa_preferencia(imovel: dict, pref: dict) -> bool:
    """Decide se um imóvel disponível atende à preferência. Critérios:
    - Tipo de negócio: se pref tem 'venda', imóvel precisa ser 'venda' ou 'ambos'.
    - Tipo de imóvel: igual quando definido.
    - Cidade/bairro: accent- e case-insensitive substring (cobre erros de digitação leves).
    - Valor mínimo: imóveis de venda < R$ 2M são excluídos (ver VALOR_MINIMO_OPORTUNIDADE).
    - Valor: dentro da faixa quando definido (usa o valor compatível com o tipo de negócio).
    - Dormitórios: imovel.dormitorios >= pref.dormitorios_min.
    Campos não definidos na preferência não filtram (preferência mais permissiva).
    """
    pref_neg = pref.get("tipo_negocio")
    if pref_neg and pref_neg != "ambos":
        if imovel.get("tipo_negocio") not in (pref_neg, "ambos"):
            return False

    pref_tipo = pref.get("tipo_imovel")
    if pref_tipo and imovel.get("tipo_imovel") != pref_tipo:
        return False

    pref_cidade = _norm((pref.get("cidade") or "").strip())
    if pref_cidade and pref_cidade not in _norm(imovel.get("cidade") or ""):
        return False

    pref_bairros = [_norm(b) for b in (pref.get("bairros") or []) if b.strip()]
    if pref_bairros:
        imovel_bairro = _norm(imovel.get("bairro") or "")
        if not any(b in imovel_bairro for b in pref_bairros):
            return False

    pref_dorm = pref.get("dormitorios_min")
    if pref_dorm:  # 0 ou None = sem requisito
        imovel_dorm = imovel.get("dormitorios")
        if imovel_dorm is None or imovel_dorm < pref_dorm:
            return False

    pref_vagas = pref.get("vagas_garagem_min")
    if pref_vagas:
        imovel_vagas = imovel.get("vagas_garagem")
        if imovel_vagas is None or imovel_vagas < pref_vagas:
            return False

    # Imóveis de venda abaixo de R$ 2M não entram como oportunidade.
    # Exceção: se o cliente quer locação e o imóvel suporta locação ("ambos"), não bloquear.
    imovel_neg = imovel.get("tipo_negocio")
    if imovel_neg == "venda" or (imovel_neg == "ambos" and pref_neg != "locacao"):
        valor_venda = imovel.get("valor_venda")
        if valor_venda is None or valor_venda < VALOR_MINIMO_OPORTUNIDADE:
            return False

    # Valor: escolhe o lado correto baseado no contexto do match
    valor_min = pref.get("valor_min")
    valor_max = pref.get("valor_max")
    if valor_min is not None or valor_max is not None:
        is_locacao_match = imovel_neg == "locacao" or (imovel_neg == "ambos" and pref_neg == "locacao")
        valor = imovel.get("valor_locacao") if is_locacao_match else imovel.get("valor_venda")
        if valor is None:
            return False
        if valor_min is not None and valor < valor_min:
            return False
        if valor_max is not None and valor > valor_max:
            return False

    return True


# ── Preferências (CRUD básico, 1:1 com cliente) ──────────────────────────────

@router.get("/clientes/{cliente_id}/preferencia", response_model=PreferenciaOut)
def obter_preferencia(cliente_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase_admin.table("cliente_preferencias")
        .select("*")
        .eq("cliente_id", cliente_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Cliente sem preferência cadastrada.")
    return result.data


@router.put("/clientes/{cliente_id}/preferencia", response_model=PreferenciaOut)
def upsert_preferencia(
    cliente_id: str,
    body: PreferenciaUpdate,
    current_user: dict = Depends(require_admin),
):
    """Cria ou atualiza a preferência do cliente (upsert por cliente_id)."""
    payload = body.model_dump(exclude_unset=True)
    payload["cliente_id"] = cliente_id

    existing = (
        supabase_admin.table("cliente_preferencias")
        .select("id")
        .eq("cliente_id", cliente_id)
        .maybe_single()
        .execute()
    )

    if existing and existing.data:
        result = (
            supabase_admin.table("cliente_preferencias")
            .update(payload)
            .eq("cliente_id", cliente_id)
            .execute()
        )
    else:
        result = supabase_admin.table("cliente_preferencias").insert(payload).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Falha ao salvar preferência.")
    return result.data[0]


@router.delete("/clientes/{cliente_id}/preferencia", status_code=status.HTTP_204_NO_CONTENT)
def remover_preferencia(cliente_id: str, current_user: dict = Depends(require_admin)):
    supabase_admin.table("cliente_preferencias").delete().eq("cliente_id", cliente_id).execute()


# ── Matches ──────────────────────────────────────────────────────────────────

@router.get("/clientes/{cliente_id}/matches", response_model=List[MatchClienteImovel])
def matches_de_um_cliente(cliente_id: str, current_user: dict = Depends(get_current_user)):
    """Retorna os imóveis disponíveis que combinam com a preferência do cliente."""
    pref_resp = (
        supabase_admin.table("cliente_preferencias")
        .select("*")
        .eq("cliente_id", cliente_id)
        .eq("ativa", True)
        .maybe_single()
        .execute()
    )
    if not pref_resp or not pref_resp.data:
        return []
    pref = pref_resp.data

    imoveis_resp = (
        supabase_admin.table("imoveis")
        .select(
            "id, codigo, cidade, bairro, tipo_imovel, tipo_negocio, "
            "valor_venda, valor_locacao, dormitorios, vagas_garagem, "
            "imovel_fotos(url, ordem)"
        )
        .eq("disponibilidade", "disponivel")
        .execute()
    )

    matches = []
    for imovel in imoveis_resp.data or []:
        if not _imovel_casa_preferencia(imovel, pref):
            continue
        fotos = sorted(imovel.get("imovel_fotos") or [], key=lambda f: f.get("ordem", 0))
        foto_capa = fotos[0]["url"] if fotos else None
        matches.append({
            "imovel_id": imovel["id"],
            "codigo": imovel["codigo"],
            "cidade": imovel["cidade"],
            "bairro": imovel["bairro"],
            "tipo_imovel": imovel["tipo_imovel"],
            "tipo_negocio": imovel["tipo_negocio"],
            "valor_venda": imovel.get("valor_venda"),
            "valor_locacao": imovel.get("valor_locacao"),
            "dormitorios": imovel.get("dormitorios"),
            "vagas_garagem": imovel.get("vagas_garagem"),
            "foto_capa": foto_capa,
            "score": _score_imovel_preferencia(pref),
        })
    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches


@router.get("/imoveis/{imovel_id}/interessados", response_model=List[MatchImovelCliente])
def interessados_em_um_imovel(imovel_id: str, current_user: dict = Depends(get_current_user)):
    """Retorna os clientes cuja preferência ativa casa com o imóvel informado."""
    imovel_resp = (
        supabase_admin.table("imoveis")
        .select(
            "id, tipo_negocio, tipo_imovel, cidade, bairro, "
            "valor_venda, valor_locacao, dormitorios, vagas_garagem"
        )
        .eq("id", imovel_id)
        .maybe_single()
        .execute()
    )
    if not imovel_resp or not imovel_resp.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    imovel = imovel_resp.data

    prefs_resp = (
        supabase_admin.table("cliente_preferencias")
        .select(
            "id, cliente_id, tipo_negocio, tipo_imovel, cidade, bairros, "
            "valor_min, valor_max, dormitorios_min, vagas_garagem_min, observacoes, "
            "clientes(nome_completo, telefone, email, tipo_cliente)"
        )
        .eq("ativa", True)
        .execute()
    )

    interessados = []
    for pref in prefs_resp.data or []:
        if not _imovel_casa_preferencia(imovel, pref):
            continue
        cliente = pref.get("clientes") or {}
        if not cliente.get("nome_completo"):
            continue
        interessados.append({
            "cliente_id": pref["cliente_id"],
            "nome_completo": cliente.get("nome_completo"),
            "telefone": cliente.get("telefone") or "",
            "email": cliente.get("email"),
            "tipo_cliente": cliente.get("tipo_cliente"),
            "preferencia_id": pref["id"],
            "observacoes_preferencia": pref.get("observacoes"),
            "score": _score_imovel_preferencia(pref),
        })
    interessados.sort(key=lambda i: i["score"], reverse=True)
    return interessados


@router.get("/oportunidades/resumo")
def resumo_oportunidades(current_user: dict = Depends(get_current_user)):
    """
    Resumo geral para o dashboard: quantas oportunidades existem hoje
    e qual o total de clientes com preferências ativas.
    """
    prefs_resp = (
        supabase_admin.table("cliente_preferencias")
        .select(
            "id, cliente_id, tipo_negocio, tipo_imovel, cidade, bairros, "
            "valor_min, valor_max, dormitorios_min, vagas_garagem_min"
        )
        .eq("ativa", True)
        .execute()
    )
    prefs = prefs_resp.data or []

    if not prefs:
        return {"total_oportunidades": 0, "clientes_com_preferencia": 0}

    imoveis_resp = (
        supabase_admin.table("imoveis")
        .select(
            "id, tipo_negocio, tipo_imovel, cidade, bairro, "
            "valor_venda, valor_locacao, dormitorios, vagas_garagem"
        )
        .eq("disponibilidade", "disponivel")
        .execute()
    )
    imoveis = imoveis_resp.data or []

    total = sum(
        1
        for pref in prefs
        for imovel in imoveis
        if _imovel_casa_preferencia(imovel, pref)
    )
    return {
        "total_oportunidades": total,
        "clientes_com_preferencia": len(prefs),
    }
