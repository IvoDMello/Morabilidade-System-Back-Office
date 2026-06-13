"""Autorização de Intermediação — geração, listagem e assinatura pelo(s) proprietário(s).

Mesma mecânica da ficha de visita ([fichas_visita]): o corretor gera, o link é
enviado ao proprietário, que assina no celular. Captura IP, data/hora, geo e
hash como trilha de auditoria. Assinatura eletrônica simples (art. 107 CC + Lei
14.063/2020).

Suporta múltiplos signatários (migration 038): cada proprietário tem o próprio
token/link e trilha individual; a autorização fica 'parcial' enquanto faltar
assinatura e 'assinada' quando todos assinarem.
"""
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.auth.dependencies import get_current_user, require_admin
from app.database import supabase_admin
from app.limiter import limiter
from app.schemas.autorizacao import (
    AutorizacaoAssinaturaIn,
    AutorizacaoCreate,
    AutorizacaoOut,
    AutorizacaoPublicaView,
)
from app.services.assinatura import ip_do_request, montar_endereco, xff_bruto
from app.services.autorizacao_pdf import gerar_autorizacao_pdf, montar_clausula_autorizacao
from app.services.storage import baixar_documento, upload_pdf_bytes

router = APIRouter()

TOKEN_VALIDADE_DIAS = 7
TABELA = "autorizacoes_intermediacao"
TABELA_SIG = "autorizacao_signatarios"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hash_documento(auth: dict, signatarios: List[dict]) -> str:
    nucleo = {
        "id": auth.get("id"),
        "imovel_codigo": auth.get("imovel_codigo"),
        "tipo_negocio": auth.get("tipo_negocio"),
        "valor_autorizado": str(auth.get("valor_autorizado")),
        "exclusiva": auth.get("exclusiva"),
        "clausula_texto": auth.get("clausula_texto"),
        "signatarios": [
            {
                "nome": s.get("nome"),
                "cpf": s.get("assinante_cpf_confirmado") or s.get("cpf"),
                "assinada_em": s.get("assinada_em"),
                "ip": s.get("assinante_ip"),
                "geo": s.get("assinante_geo"),
            }
            for s in sorted(signatarios, key=lambda s: s.get("ordem") or 0)
        ],
    }
    canonico = json.dumps(nucleo, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonico.encode("utf-8")).hexdigest()


def _buscar(auth_id: str) -> dict:
    res = supabase_admin.table(TABELA).select("*").eq("id", auth_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Autorização não encontrada.")
    return res.data


def _signatarios_de(auth_id: str) -> List[dict]:
    res = (
        supabase_admin.table(TABELA_SIG)
        .select("*")
        .eq("autorizacao_id", auth_id)
        .order("ordem")
        .execute()
    )
    return res.data or []


def _anexar_signatarios(auths: List[dict]) -> List[dict]:
    """Anexa a lista de signatários a cada autorização (1 query para o lote)."""
    if not auths:
        return auths
    ids = [a["id"] for a in auths]
    res = (
        supabase_admin.table(TABELA_SIG)
        .select("*")
        .in_("autorizacao_id", ids)
        .order("ordem")
        .execute()
    )
    por_auth: dict = {}
    for s in res.data or []:
        por_auth.setdefault(s["autorizacao_id"], []).append(s)
    for a in auths:
        a["signatarios"] = por_auth.get(a["id"], [])
    return auths


# ── Endpoints autenticados ───────────────────────────────────────────────────

@router.post("", response_model=AutorizacaoOut, status_code=status.HTTP_201_CREATED)
def criar_autorizacao(body: AutorizacaoCreate, current_user: dict = Depends(require_admin)):
    imovel = (
        supabase_admin.table("imoveis")
        .select("id, codigo, logradouro, numero, complemento, bairro, cidade, "
                "numero_matricula, proprietario_id, valor_venda, valor_locacao")
        .eq("id", body.imovel_id)
        .maybe_single()
        .execute()
    )
    if not imovel or not imovel.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    imovel = imovel.data

    # Proprietário principal: snapshot do cliente vinculado, com override do body.
    prop_id = body.proprietario_id or imovel.get("proprietario_id")
    prop = {}
    if prop_id:
        r = (
            supabase_admin.table("clientes")
            .select("nome_completo, cpf_cnpj, telefone, email, endereco")
            .eq("id", prop_id)
            .maybe_single()
            .execute()
        )
        if r and r.data:
            prop = r.data

    # Lista de signatários: `proprietarios` (novo) ou os campos avulsos (legado).
    if body.proprietarios:
        signatarios_in = [
            {
                "nome": p.nome.strip(),
                "cpf": (p.cpf or "").strip() or None,
                "telefone": (p.telefone or "").strip() or None,
                "email": (p.email or "").strip() or None,
            }
            for p in body.proprietarios
        ]
        # O primeiro herda do cadastro do cliente o que não foi informado.
        signatarios_in[0] = {
            "nome": signatarios_in[0]["nome"],
            "cpf": signatarios_in[0]["cpf"] or (prop.get("cpf_cnpj") or "").strip() or None,
            "telefone": signatarios_in[0]["telefone"] or (prop.get("telefone") or "").strip() or None,
            "email": signatarios_in[0]["email"] or (prop.get("email") or "").strip() or None,
        }
    else:
        nome = body.proprietario_nome or prop.get("nome_completo")
        if not nome:
            raise HTTPException(
                status_code=400,
                detail="Informe o proprietário (ou vincule um proprietário ao imóvel).",
            )
        signatarios_in = [{
            "nome": nome.strip(),
            "cpf": (body.proprietario_cpf or prop.get("cpf_cnpj") or "").strip() or None,
            "telefone": (body.proprietario_telefone or prop.get("telefone") or "").strip() or None,
            "email": (body.proprietario_email or prop.get("email") or "").strip() or None,
        }]

    corretor_id = body.corretor_id or current_user["id"]
    corretor = (
        supabase_admin.table("usuarios")
        .select("nome_completo, creci")
        .eq("id", corretor_id)
        .maybe_single()
        .execute()
    )
    corretor_data = corretor.data if corretor and corretor.data else {}

    # Valor padrão conforme o negócio.
    valor = body.valor_autorizado
    if valor is None:
        valor = imovel.get("valor_locacao") if body.tipo_negocio == "locacao" else imovel.get("valor_venda")

    clausula = montar_clausula_autorizacao(
        tipo_negocio=body.tipo_negocio,
        valor_autorizado=valor,
        exclusiva=body.exclusiva,
        comissao_venda_pct=body.comissao_venda_pct,
        comissao_locacao_desc=body.comissao_locacao_desc,
        prazo_dias=body.prazo_dias,
    )

    tokens = [secrets.token_urlsafe(32) for _ in signatarios_in]
    principal = signatarios_in[0]

    agora = datetime.now(timezone.utc)
    payload = {
        "imovel_id": imovel["id"],
        "proprietario_id": prop_id,
        "corretor_id": corretor_id,
        "created_by": current_user["id"],
        # Snapshot do signatário principal (compat com listagens antigas).
        "proprietario_nome": principal["nome"],
        "proprietario_cpf": principal["cpf"],
        "proprietario_telefone": principal["telefone"],
        "proprietario_email": principal["email"],
        "proprietario_endereco": (body.proprietario_endereco or prop.get("endereco") or "").strip() or None,
        "imovel_codigo": imovel.get("codigo"),
        "imovel_endereco": montar_endereco(imovel),
        "imovel_bairro": imovel.get("bairro"),
        "imovel_cidade": imovel.get("cidade"),
        "imovel_matricula": imovel.get("numero_matricula"),
        "tipo_negocio": body.tipo_negocio,
        "valor_autorizado": float(valor) if valor is not None else None,
        "exclusiva": body.exclusiva,
        "comissao_venda_pct": float(body.comissao_venda_pct) if body.comissao_venda_pct is not None else None,
        "comissao_locacao_desc": body.comissao_locacao_desc,
        "prazo_dias": body.prazo_dias,
        "corretor_nome": corretor_data.get("nome_completo"),
        "corretor_creci": corretor_data.get("creci"),
        "clausula_texto": clausula,
        "status": "pendente",
        # O token da autorização é o do signatário principal (links legados).
        "token": tokens[0],
        "token_expira_em": (agora + timedelta(days=TOKEN_VALIDADE_DIAS)).isoformat(),
    }

    res = supabase_admin.table(TABELA).insert(payload).execute()
    auth = res.data[0]

    linhas = [
        {
            "autorizacao_id": auth["id"],
            "ordem": i + 1,
            "nome": s["nome"],
            "cpf": s["cpf"],
            "telefone": s["telefone"],
            "email": s["email"],
            "token": tokens[i],
            "status": "pendente",
        }
        for i, s in enumerate(signatarios_in)
    ]
    sig_res = supabase_admin.table(TABELA_SIG).insert(linhas).execute()
    auth["signatarios"] = sig_res.data or linhas
    return auth


@router.get("", response_model=List[AutorizacaoOut])
def listar_autorizacoes(
    imovel_id: Optional[str] = Query(None),
    proprietario_id: Optional[str] = Query(None),
    status_filtro: Optional[str] = Query(None, alias="status"),
    apenas_disponiveis: bool = Query(False, description="Só autorizações de imóveis disponíveis hoje"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    # Disponibilidade ATUAL do imóvel (inner join), não o snapshot.
    colunas = "*, imoveis!inner(disponibilidade)" if apenas_disponiveis else "*"
    q = supabase_admin.table(TABELA).select(colunas)
    if apenas_disponiveis:
        q = q.eq("imoveis.disponibilidade", "disponivel")
    if imovel_id:
        q = q.eq("imovel_id", imovel_id)
    if proprietario_id:
        q = q.eq("proprietario_id", proprietario_id)
    if status_filtro:
        q = q.eq("status", status_filtro)
    inicio = (page - 1) * page_size
    res = q.order("created_at", desc=True).range(inicio, inicio + page_size - 1).execute()
    return _anexar_signatarios(res.data or [])


@router.get("/{auth_id}", response_model=AutorizacaoOut)
def obter_autorizacao(auth_id: str, current_user: dict = Depends(get_current_user)):
    auth = _buscar(auth_id)
    auth["signatarios"] = _signatarios_de(auth_id)
    return auth


@router.get("/{auth_id}/pdf")
def baixar_pdf(auth_id: str, current_user: dict = Depends(get_current_user)):
    auth = _buscar(auth_id)
    if auth.get("status") == "assinada" and auth.get("pdf_path"):
        pdf_bytes = baixar_documento(auth["pdf_path"])
    else:
        auth["signatarios"] = _signatarios_de(auth_id)
        pdf_bytes = gerar_autorizacao_pdf(auth, assinada=False)
    nome = f"autorizacao-{auth.get('imovel_codigo') or auth_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nome}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/{auth_id}/cancelar", response_model=AutorizacaoOut)
def cancelar_autorizacao(auth_id: str, current_user: dict = Depends(require_admin)):
    auth = _buscar(auth_id)
    if auth.get("status") == "assinada":
        raise HTTPException(status_code=409, detail="Autorização já assinada não pode ser cancelada.")
    res = (
        supabase_admin.table(TABELA)
        .update({"status": "cancelada", "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", auth_id)
        .execute()
    )
    auth = res.data[0]
    auth["signatarios"] = _signatarios_de(auth_id)
    return auth


# ── Endpoints públicos (assinatura via token individual) ─────────────────────

def _por_token(token: str) -> Tuple[dict, dict]:
    """Resolve o token do signatário → (signatário, autorização)."""
    res = supabase_admin.table(TABELA_SIG).select("*").eq("token", token).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Link inválido.")
    sig = res.data
    auth = _buscar(sig["autorizacao_id"])
    return sig, auth


def _checar_disponivel(auth: dict) -> None:
    """410 se a autorização não está mais aberta para este link."""
    if auth.get("status") == "cancelada":
        raise HTTPException(status_code=410, detail="Esta autorização foi cancelada.")
    if auth.get("status") == "expirada":
        raise HTTPException(status_code=410, detail="O link de assinatura expirou.")
    if auth.get("status") == "assinada":
        return
    expira = auth.get("token_expira_em")
    if expira:
        try:
            if datetime.fromisoformat(str(expira).replace("Z", "+00:00")) < datetime.now(timezone.utc):
                supabase_admin.table(TABELA).update({"status": "expirada"}).eq("id", auth["id"]).execute()
                raise HTTPException(status_code=410, detail="O link de assinatura expirou.")
        except ValueError:
            pass


def _view_publica(sig: dict, auth: dict, signatarios: Optional[List[dict]] = None) -> dict:
    signatarios = signatarios if signatarios is not None else _signatarios_de(auth["id"])
    view = dict(auth)
    view["signatario_nome"] = sig["nome"]
    view["ja_assinou"] = sig.get("status") == "assinada"
    view["signatarios"] = [
        {"nome": s["nome"], "assinou": s.get("status") == "assinada"}
        for s in signatarios
    ]
    return view


@router.get("/assinar/{token}", response_model=AutorizacaoPublicaView)
@limiter.limit("30/minute")
def ver_autorizacao_publica(request: Request, token: str):
    sig, auth = _por_token(token)
    _checar_disponivel(auth)
    return _view_publica(sig, auth)


@router.post("/assinar/{token}", response_model=AutorizacaoPublicaView)
@limiter.limit("10/minute")
def assinar_autorizacao(request: Request, token: str, body: AutorizacaoAssinaturaIn):
    sig, auth = _por_token(token)
    _checar_disponivel(auth)
    if auth.get("status") == "assinada" or sig.get("status") == "assinada":
        raise HTTPException(status_code=410, detail="Esta assinatura já foi registrada.")
    if not body.aceite:
        raise HTTPException(status_code=400, detail="É necessário aceitar os termos para assinar.")

    agora = datetime.now(timezone.utc)
    trilha = {
        "status": "assinada",
        "assinada_em": agora.isoformat(),
        "assinante_ip": ip_do_request(request),
        "assinante_xff": xff_bruto(request),
        "assinante_user_agent": (request.headers.get("user-agent") or "")[:500],
        "assinante_geo": (body.geo or "").strip() or None,
        "assinante_assinatura_png": body.assinatura_png,
        "assinante_cpf_confirmado": body.cpf.strip(),
        "updated_at": agora.isoformat(),
    }
    supabase_admin.table(TABELA_SIG).update(trilha).eq("id", sig["id"]).execute()

    signatarios = _signatarios_de(auth["id"])
    todos_assinaram = all(s.get("status") == "assinada" for s in signatarios)

    update = {"updated_at": agora.isoformat()}
    if sig.get("ordem") == 1:
        # Espelha a trilha do principal nas colunas legadas da autorização.
        update.update({
            "assinante_ip": trilha["assinante_ip"],
            "assinante_xff": trilha["assinante_xff"],
            "assinante_user_agent": trilha["assinante_user_agent"],
            "assinante_geo": trilha["assinante_geo"],
            "assinante_assinatura_png": trilha["assinante_assinatura_png"],
            "assinante_cpf_confirmado": trilha["assinante_cpf_confirmado"],
        })

    if todos_assinaram:
        auth_final = dict(auth)
        auth_final["signatarios"] = signatarios
        doc_hash = _hash_documento(auth_final, signatarios)
        auth_final["documento_hash"] = doc_hash
        auth_final["assinada_em"] = agora.isoformat()

        pdf_bytes = gerar_autorizacao_pdf(auth_final, assinada=True)
        pdf_path = upload_pdf_bytes(pdf_bytes, f"autorizacoes/{auth['id']}.pdf")
        update.update({
            "status": "assinada",
            "assinada_em": agora.isoformat(),
            "documento_hash": doc_hash,
            "pdf_path": pdf_path,
        })
    else:
        update["status"] = "parcial"

    res = supabase_admin.table(TABELA).update(update).eq("id", auth["id"]).execute()
    sig = dict(sig, **trilha)
    return _view_publica(sig, res.data[0], signatarios)


@router.get("/assinar/{token}/pdf")
@limiter.limit("30/minute")
def baixar_pdf_publico(request: Request, token: str):
    sig, auth = _por_token(token)
    if auth.get("status") != "assinada" or not auth.get("pdf_path"):
        raise HTTPException(status_code=409, detail="Autorização ainda não assinada por todos os proprietários.")
    pdf_bytes = baixar_documento(auth["pdf_path"])
    nome = f"autorizacao-{auth.get('imovel_codigo') or auth['id'][:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nome}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
