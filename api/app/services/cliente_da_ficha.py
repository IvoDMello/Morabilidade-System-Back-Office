"""Integração da Ficha de Visita com o CRM de clientes.

Tudo acontece na ASSINATURA da ficha (best-effort — uma falha aqui nunca pode
bloquear o fluxo jurídico; o router envolve a chamada em try/except):

`atualizar_cadastro_pos_assinatura`:
1. Se a ficha não tem cliente vinculado, procura um cadastro existente pelos
   dados do visitante (CPF confirmado → telefone → e-mail) e, não havendo,
   cadastra um novo lead com origem 'ficha_visita'. Visitante que nunca
   assina NÃO entra no CRM — evita cadastros mortos de fichas abandonadas.
2. Completa o CPF do cadastro com o confirmado na assinatura.
3. Infere o perfil de imóvel buscado (cliente_preferencias) agregando todas
   as fichas assinadas do cliente. A inferência só cria/recalcula
   preferências com origem 'ficha_visita' — preferência manual do corretor
   nunca é sobrescrita (ver migration 037).
"""
import re
import unicodedata
from typing import Optional, Tuple

from app.database import supabase_admin

# Folga aplicada à faixa de valores inferida: as visitas revelam a ordem de
# grandeza do orçamento do cliente, não os limites exatos.
FOLGA_VALOR_MIN = 0.8
FOLGA_VALOR_MAX = 1.2


# ── Normalização ─────────────────────────────────────────────────────────────

def _so_digitos(s: Optional[str]) -> str:
    return re.sub(r"\D", "", s or "")


def _norm(s: Optional[str]) -> str:
    """Lowercase sem acentos para comparações insensíveis a grafia."""
    nfkd = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).strip().lower()


def _mesmo_telefone(a: Optional[str], b: Optional[str]) -> bool:
    """Compara pelo sufixo de 8 dígitos — tolera +55, DDD e o 9 extra."""
    da, db = _so_digitos(a), _so_digitos(b)
    return len(da) >= 8 and len(db) >= 8 and da[-8:] == db[-8:]


# ── Dedup/cadastro do visitante (chamado na assinatura) ─────────────────────

def _encontrar_cliente(cpf: Optional[str], telefone: Optional[str], email: Optional[str]) -> Optional[dict]:
    """Deduplicação por dado de contato, nunca por nome (homônimos).

    A base de clientes é pequena — busca tudo e normaliza em Python, mesmo
    padrão do matching de oportunidades. Ordem de confiança:
    CPF → telefone → e-mail.
    """
    res = (
        supabase_admin.table("clientes")
        .select("id, nome_completo, cpf_cnpj, telefone, telefone_secundario, email")
        .execute()
    )
    clientes = res.data or []

    cpf_digitos = _so_digitos(cpf)
    if cpf_digitos:
        for c in clientes:
            if _so_digitos(c.get("cpf_cnpj")) == cpf_digitos:
                return c

    if telefone:
        for c in clientes:
            if _mesmo_telefone(telefone, c.get("telefone")) or _mesmo_telefone(telefone, c.get("telefone_secundario")):
                return c

    email_norm = _norm(email)
    if email_norm:
        for c in clientes:
            if _norm(c.get("email")) == email_norm:
                return c

    return None


def vincular_cliente_visitante(
    ficha_payload: dict, imovel: dict, corretor_id: Optional[str]
) -> Tuple[Optional[str], bool]:
    """Resolve o cliente do visitante da ficha. Retorna (cliente_id, foi_criado).

    Sem telefone não há como cadastrar (o cadastro de cliente exige telefone
    ou Instagram) — nesse caso ainda tenta deduplicar por CPF/e-mail e, não
    encontrando, retorna (None, False).
    """
    cpf = ficha_payload.get("visitante_cpf")
    telefone = ficha_payload.get("visitante_telefone")
    email = ficha_payload.get("visitante_email")

    existente = _encontrar_cliente(cpf, telefone, email)
    if existente:
        return existente["id"], False

    if not (telefone or "").strip():
        return None, False

    tipo_cliente = "locatario" if imovel.get("tipo_negocio") == "locacao" else "comprador"
    novo = {
        "nome_completo": ficha_payload["visitante_nome"],
        "telefone": telefone.strip(),
        "email": (email or "").strip() or None,
        "cpf_cnpj": (cpf or "").strip() or None,
        "origem_lead": "ficha_visita",
        "tipo_cliente": tipo_cliente,
        "status": "ativo",
        "corretor_id": corretor_id,
        "observacoes": "Cadastrado automaticamente via ficha de visita.",
    }
    res = supabase_admin.table("clientes").insert(novo).execute()
    return res.data[0]["id"], True


# ── Assinatura: CPF confirmado + perfil inferido ─────────────────────────────

def atualizar_cadastro_pos_assinatura(ficha: dict) -> None:
    """Após a assinatura: vincula/cadastra o cliente (se a ficha ainda não tem
    vínculo), completa o CPF do cadastro (se vazio) e recalcula o perfil de
    busca inferido das visitas."""
    cliente_id = ficha.get("cliente_id")

    if not cliente_id:
        # Cadastro só na assinatura: ficha pendente/expirada não vira cliente.
        imovel_res = (
            supabase_admin.table("imoveis")
            .select("tipo_negocio")
            .eq("id", ficha.get("imovel_id"))
            .maybe_single()
            .execute()
        )
        imovel = imovel_res.data if imovel_res and imovel_res.data else {}
        # O CPF confirmado na assinatura é mais confiável que o informado na geração.
        payload = dict(ficha)
        payload["visitante_cpf"] = ficha.get("assinante_cpf_confirmado") or ficha.get("visitante_cpf")
        cliente_id, _ = vincular_cliente_visitante(payload, imovel, ficha.get("corretor_id"))
        if not cliente_id:
            return
        supabase_admin.table("fichas_visita").update(
            {"cliente_id": cliente_id}
        ).eq("id", ficha["id"]).execute()
        ficha["cliente_id"] = cliente_id

    cpf = _so_digitos(ficha.get("assinante_cpf_confirmado"))
    if cpf:
        cli = (
            supabase_admin.table("clientes")
            .select("cpf_cnpj")
            .eq("id", cliente_id)
            .maybe_single()
            .execute()
        )
        if cli and cli.data and not (cli.data.get("cpf_cnpj") or "").strip():
            supabase_admin.table("clientes").update({"cpf_cnpj": cpf}).eq("id", cliente_id).execute()

    inferir_preferencia(cliente_id)


def inferir_preferencia(cliente_id: str) -> None:
    """Cria/recalcula a preferência inferida agregando todas as fichas de
    visita assinadas do cliente. Preferência manual nunca é tocada."""
    res = (
        supabase_admin.table("cliente_preferencias")
        .select("id, origem")
        .eq("cliente_id", cliente_id)
        .maybe_single()
        .execute()
    )
    existente = res.data if res else None
    if existente and existente.get("origem") != "ficha_visita":
        return  # preferência manual — o corretor manda

    fichas = (
        supabase_admin.table("fichas_visita")
        .select("imovel_id")
        .eq("cliente_id", cliente_id)
        .eq("status", "assinada")
        .execute()
    )
    imovel_ids = sorted({f["imovel_id"] for f in (fichas.data or []) if f.get("imovel_id")})
    if not imovel_ids:
        return

    imoveis_res = (
        supabase_admin.table("imoveis")
        .select("id, tipo_negocio, tipo_imovel, cidade, bairro, valor_venda, valor_locacao, dormitorios")
        .in_("id", imovel_ids)
        .execute()
    )
    imoveis = imoveis_res.data or []
    if not imoveis:
        return

    pref = _montar_preferencia(imoveis)
    pref["origem"] = "ficha_visita"
    pref["ativa"] = True

    if existente:
        supabase_admin.table("cliente_preferencias").update(pref).eq("cliente_id", cliente_id).execute()
    else:
        pref["cliente_id"] = cliente_id
        supabase_admin.table("cliente_preferencias").insert(pref).execute()


def _montar_preferencia(imoveis: list) -> dict:
    """Agrega os imóveis visitados num perfil de busca.

    Critério geral: convergência define, divergência relaxa — no matching,
    campo vazio não filtra, o que é preferível a um filtro errado.
    """
    # Tipo de negócio: só conta intenção clara ('ambos' no imóvel não revela nada).
    negocios = {i.get("tipo_negocio") for i in imoveis if i.get("tipo_negocio") in ("venda", "locacao")}
    tipo_negocio = negocios.pop() if len(negocios) == 1 else "ambos"

    tipos = {i.get("tipo_imovel") for i in imoveis if i.get("tipo_imovel")}
    tipo_imovel = tipos.pop() if len(tipos) == 1 else None

    cidades: dict = {}
    bairros: dict = {}
    for i in imoveis:
        if i.get("cidade"):
            cidades.setdefault(_norm(i["cidade"]), i["cidade"])
        if i.get("bairro"):
            bairros.setdefault(_norm(i["bairro"]), i["bairro"])
    cidade = next(iter(cidades.values())) if len(cidades) == 1 else None

    # Faixa de valor: só quando a intenção de negócio é clara — misturar
    # valores de venda (milhões) e locação (milhares) produziria lixo.
    valor_min = valor_max = None
    if tipo_negocio in ("venda", "locacao"):
        campo = "valor_venda" if tipo_negocio == "venda" else "valor_locacao"
        valores = [float(i[campo]) for i in imoveis if i.get(campo) is not None]
        if valores:
            valor_min = round(min(valores) * FOLGA_VALOR_MIN, 2)
            valor_max = round(max(valores) * FOLGA_VALOR_MAX, 2)

    dormitorios = [i["dormitorios"] for i in imoveis if i.get("dormitorios") is not None]

    total = len(imoveis)
    rotulo = "imóveis visitados" if total != 1 else "imóvel visitado"
    return {
        "tipo_negocio": tipo_negocio,
        "tipo_imovel": tipo_imovel,
        "cidade": cidade,
        "bairros": sorted(bairros.values()),
        "valor_min": valor_min,
        "valor_max": valor_max,
        "dormitorios_min": min(dormitorios) if dormitorios else None,
        "observacoes": f"Perfil inferido automaticamente a partir de {total} {rotulo} (fichas assinadas).",
    }
