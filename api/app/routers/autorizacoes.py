"""Autorização de Intermediação — geração, listagem e assinatura pelo proprietário.

Mesma mecânica da ficha de visita ([fichas_visita]): o corretor gera, o link é
enviado ao proprietário, que assina no celular. Captura IP, data/hora, geo e
hash como trilha de auditoria. Assinatura eletrônica simples (art. 107 CC + Lei
14.063/2020).
"""
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

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
from app.services.autorizacao_pdf import gerar_autorizacao_pdf, montar_clausula_autorizacao
from app.services.storage import baixar_documento, upload_pdf_bytes

router = APIRouter()

TOKEN_VALIDADE_DIAS = 7
TABELA = "autorizacoes_intermediacao"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _montar_endereco(imovel: dict) -> str:
    partes = [imovel.get("logradouro")]
    if imovel.get("numero"):
        partes.append(str(imovel["numero"]))
    if imovel.get("complemento"):
        partes.append(str(imovel["complemento"]))
    return ", ".join(p for p in partes if p)


def _ip_do_request(request: Request) -> Optional[str]:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


def _hash_documento(auth: dict) -> str:
    nucleo = {
        "id": auth.get("id"),
        "imovel_codigo": auth.get("imovel_codigo"),
        "proprietario_nome": auth.get("proprietario_nome"),
        "cpf": auth.get("assinante_cpf_confirmado"),
        "tipo_negocio": auth.get("tipo_negocio"),
        "valor_autorizado": str(auth.get("valor_autorizado")),
        "exclusiva": auth.get("exclusiva"),
        "clausula_texto": auth.get("clausula_texto"),
        "assinada_em": auth.get("assinada_em"),
        "ip": auth.get("assinante_ip"),
        "geo": auth.get("assinante_geo"),
    }
    canonico = json.dumps(nucleo, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonico.encode("utf-8")).hexdigest()


def _buscar(auth_id: str) -> dict:
    res = supabase_admin.table(TABELA).select("*").eq("id", auth_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Autorização não encontrada.")
    return res.data


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

    # Proprietário: snapshot do cliente vinculado, com override pelos campos do body.
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

    proprietario_nome = body.proprietario_nome or prop.get("nome_completo")
    if not proprietario_nome:
        raise HTTPException(
            status_code=400,
            detail="Informe o proprietário (ou vincule um proprietário ao imóvel).",
        )

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

    agora = datetime.now(timezone.utc)
    payload = {
        "imovel_id": imovel["id"],
        "proprietario_id": prop_id,
        "corretor_id": corretor_id,
        "created_by": current_user["id"],
        "proprietario_nome": proprietario_nome.strip(),
        "proprietario_cpf": (body.proprietario_cpf or prop.get("cpf_cnpj") or "").strip() or None,
        "proprietario_telefone": (body.proprietario_telefone or prop.get("telefone") or "").strip() or None,
        "proprietario_email": (body.proprietario_email or prop.get("email") or "").strip() or None,
        "proprietario_endereco": (body.proprietario_endereco or prop.get("endereco") or "").strip() or None,
        "imovel_codigo": imovel.get("codigo"),
        "imovel_endereco": _montar_endereco(imovel),
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
        "token": secrets.token_urlsafe(32),
        "token_expira_em": (agora + timedelta(days=TOKEN_VALIDADE_DIAS)).isoformat(),
    }

    res = supabase_admin.table(TABELA).insert(payload).execute()
    return res.data[0]


@router.get("", response_model=List[AutorizacaoOut])
def listar_autorizacoes(
    imovel_id: Optional[str] = Query(None),
    proprietario_id: Optional[str] = Query(None),
    status_filtro: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    q = supabase_admin.table(TABELA).select("*")
    if imovel_id:
        q = q.eq("imovel_id", imovel_id)
    if proprietario_id:
        q = q.eq("proprietario_id", proprietario_id)
    if status_filtro:
        q = q.eq("status", status_filtro)
    inicio = (page - 1) * page_size
    res = q.order("created_at", desc=True).range(inicio, inicio + page_size - 1).execute()
    return res.data or []


@router.get("/{auth_id}", response_model=AutorizacaoOut)
def obter_autorizacao(auth_id: str, current_user: dict = Depends(get_current_user)):
    return _buscar(auth_id)


@router.get("/{auth_id}/pdf")
def baixar_pdf(auth_id: str, current_user: dict = Depends(get_current_user)):
    auth = _buscar(auth_id)
    if auth.get("status") == "assinada" and auth.get("pdf_path"):
        pdf_bytes = baixar_documento(auth["pdf_path"])
    else:
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
    return res.data[0]


# ── Endpoints públicos (assinatura via token) ────────────────────────────────

def _assinavel(token: str) -> dict:
    res = supabase_admin.table(TABELA).select("*").eq("token", token).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Link inválido.")
    auth = res.data
    if auth.get("status") == "assinada":
        raise HTTPException(status_code=410, detail="Esta autorização já foi assinada.")
    if auth.get("status") == "cancelada":
        raise HTTPException(status_code=410, detail="Esta autorização foi cancelada.")
    expira = auth.get("token_expira_em")
    if expira:
        try:
            if datetime.fromisoformat(str(expira).replace("Z", "+00:00")) < datetime.now(timezone.utc):
                supabase_admin.table(TABELA).update({"status": "expirada"}).eq("id", auth["id"]).execute()
                raise HTTPException(status_code=410, detail="O link de assinatura expirou.")
        except ValueError:
            pass
    return auth


@router.get("/assinar/{token}", response_model=AutorizacaoPublicaView)
@limiter.limit("30/minute")
def ver_autorizacao_publica(request: Request, token: str):
    return _assinavel(token)


@router.post("/assinar/{token}", response_model=AutorizacaoPublicaView)
@limiter.limit("10/minute")
def assinar_autorizacao(request: Request, token: str, body: AutorizacaoAssinaturaIn):
    auth = _assinavel(token)
    if not body.aceite:
        raise HTTPException(status_code=400, detail="É necessário aceitar os termos para assinar.")

    agora = datetime.now(timezone.utc)
    auth["assinada_em"] = agora.isoformat()
    auth["assinante_ip"] = _ip_do_request(request)
    auth["assinante_user_agent"] = (request.headers.get("user-agent") or "")[:500]
    auth["assinante_geo"] = (body.geo or "").strip() or None
    auth["assinante_assinatura_png"] = body.assinatura_png
    auth["assinante_cpf_confirmado"] = body.cpf.strip()
    auth["documento_hash"] = _hash_documento(auth)

    pdf_bytes = gerar_autorizacao_pdf(auth, assinada=True)
    pdf_path = upload_pdf_bytes(pdf_bytes, f"autorizacoes/{auth['id']}.pdf")

    update = {
        "status": "assinada",
        "assinada_em": auth["assinada_em"],
        "assinante_ip": auth["assinante_ip"],
        "assinante_user_agent": auth["assinante_user_agent"],
        "assinante_geo": auth["assinante_geo"],
        "assinante_assinatura_png": auth["assinante_assinatura_png"],
        "assinante_cpf_confirmado": auth["assinante_cpf_confirmado"],
        "documento_hash": auth["documento_hash"],
        "pdf_path": pdf_path,
        "updated_at": agora.isoformat(),
    }
    res = supabase_admin.table(TABELA).update(update).eq("id", auth["id"]).execute()
    return res.data[0]


@router.get("/assinar/{token}/pdf")
@limiter.limit("30/minute")
def baixar_pdf_publico(request: Request, token: str):
    res = supabase_admin.table(TABELA).select("*").eq("token", token).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Link inválido.")
    auth = res.data
    if auth.get("status") != "assinada" or not auth.get("pdf_path"):
        raise HTTPException(status_code=409, detail="Autorização ainda não assinada.")
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
