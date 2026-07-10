"""Ficha / Termo de Visita a Imóvel — geração, listagem e assinatura eletrônica.

Fluxo:
1. Corretor cria a ficha (`POST /fichas-visita`) — o sistema monta um snapshot
   imutável do imóvel/corretor e gera um `token` de assinatura.
2. O link `/<site>/ficha/<token>` é enviado ao visitante (ex.: WhatsApp).
3. O visitante abre, confere e assina (`POST /fichas-visita/assinar/<token>`) —
   capturamos IP, data/hora, geolocalização e o hash dos dados como trilha de
   auditoria, e geramos o PDF assinado guardado no storage.

Assinatura eletrônica simples, válida entre particulares (art. 107 do Código
Civil + Lei nº 14.063/2020).
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.dependencies import get_current_user, require_admin
from app.database import supabase_admin
from app.limiter import limiter
from app.schemas.ficha_visita import (
    FichaVisitaAssinaturaIn,
    FichaVisitaCreate,
    FichaVisitaOut,
    FichaVisitaPublicaView,
)
from app.services.assinatura import (
    expira_em,
    gerar_token,
    ip_do_request,
    montar_endereco,
    pdf_response,
    sha256_canonico,
    token_expirado,
    xff_bruto,
)
from app.services.cliente_da_ficha import atualizar_cadastro_pos_assinatura
from app.services.ficha_visita_pdf import gerar_ficha_visita_pdf, montar_clausula
from app.services.storage import baixar_documento, upload_pdf_bytes

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _hash_documento(ficha: dict) -> str:
    """SHA-256 sobre os dados essenciais assinados (não sobre o PDF renderizado,
    que carrega timestamps não determinísticos). Prova a integridade do acordo."""
    nucleo = {
        "id": ficha.get("id"),
        "imovel_codigo": ficha.get("imovel_codigo"),
        "imovel_endereco": ficha.get("imovel_endereco"),
        "visitante_nome": ficha.get("visitante_nome"),
        "cpf": ficha.get("assinante_cpf_confirmado"),
        "clausula_texto": ficha.get("clausula_texto"),
        "assinada_em": ficha.get("assinada_em"),
        "ip": ficha.get("assinante_ip"),
        "geo": ficha.get("assinante_geo"),
    }
    return sha256_canonico(nucleo)


def _buscar_ficha(ficha_id: str) -> dict:
    res = supabase_admin.table("fichas_visita").select("*").eq("id", ficha_id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Ficha de visita não encontrada.")
    return res.data


# ── Endpoints autenticados ───────────────────────────────────────────────────

@router.post("", response_model=FichaVisitaOut, status_code=status.HTTP_201_CREATED)
def criar_ficha(body: FichaVisitaCreate, current_user: dict = Depends(require_admin)):
    imovel = (
        supabase_admin.table("imoveis")
        .select("id, codigo, logradouro, numero, complemento, bairro, cidade, "
                "valor_venda, valor_locacao, tipo_negocio, proprietario_id")
        .eq("id", body.imovel_id)
        .maybe_single()
        .execute()
    )
    if not imovel or not imovel.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    imovel = imovel.data

    # Proprietário (snapshot do nome, se houver vínculo).
    proprietario_nome = None
    if imovel.get("proprietario_id"):
        prop = (
            supabase_admin.table("clientes")
            .select("nome_completo")
            .eq("id", imovel["proprietario_id"])
            .maybe_single()
            .execute()
        )
        if prop and prop.data:
            proprietario_nome = prop.data.get("nome_completo")

    # Corretor responsável (default = usuário atual). A ficha é um documento
    # jurídico de corretagem: o corretor precisa existir, estar ativo e ter
    # nome + CRECI — senão o PDF assinado sairia sem identificação válida.
    corretor_id = body.corretor_id or current_user["id"]
    if corretor_id != current_user["id"] and current_user.get("perfil") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Somente administradores podem emitir ficha em nome de outro corretor.",
        )
    corretor = (
        supabase_admin.table("usuarios")
        .select("nome_completo, creci, ativo, ocultar_creci_ficha")
        .eq("id", corretor_id)
        .maybe_single()
        .execute()
    )
    corretor_data = corretor.data if corretor and corretor.data else {}
    if not (corretor_data.get("nome_completo") or "").strip():
        raise HTTPException(status_code=400, detail="Corretor responsável não encontrado.")
    if not corretor_data.get("ativo", True):
        raise HTTPException(status_code=400, detail="O corretor responsável está com a conta desativada.")
    # Com a flag "ocultar CRECI" ativa o número não é exibido nem exigido.
    ocultar_creci = bool(corretor_data.get("ocultar_creci_ficha"))
    if not ocultar_creci and not (corretor_data.get("creci") or "").strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "O corretor responsável não tem CRECI cadastrado. "
                "Preencha o CRECI no perfil do usuário antes de gerar a ficha."
            ),
        )

    valor = imovel.get("valor_venda") or imovel.get("valor_locacao")
    agora = datetime.now(timezone.utc)

    payload = {
        "imovel_id": imovel["id"],
        "corretor_id": corretor_id,
        "cliente_id": body.cliente_id,
        "created_by": current_user["id"],
        "visitante_nome": body.visitante_nome.strip(),
        "visitante_cpf": (body.visitante_cpf or "").strip() or None,
        "visitante_rg": (body.visitante_rg or "").strip() or None,
        "visitante_telefone": (body.visitante_telefone or "").strip() or None,
        "visitante_email": (body.visitante_email or "").strip() or None,
        "imovel_codigo": imovel.get("codigo"),
        "imovel_endereco": montar_endereco(imovel),
        "imovel_bairro": imovel.get("bairro"),
        "imovel_cidade": imovel.get("cidade"),
        "imovel_valor": float(valor) if valor is not None else None,
        "proprietario_nome": proprietario_nome,
        "corretor_nome": corretor_data.get("nome_completo"),
        "corretor_creci": None if ocultar_creci else corretor_data.get("creci"),
        "ocultar_creci": ocultar_creci,
        "clausula_texto": montar_clausula(body.prazo_meses),
        "prazo_meses": body.prazo_meses,
        "status": "pendente",
        "token": gerar_token(),
        "token_expira_em": expira_em(agora),
    }

    # O vínculo/cadastro do visitante no CRM acontece só na ASSINATURA
    # (atualizar_cadastro_pos_assinatura) — ficha que nunca é assinada não
    # vira cliente, evitando cadastros mortos na base.
    res = supabase_admin.table("fichas_visita").insert(payload).execute()
    return res.data[0]


def _filtro_periodo(q, de: Optional[str], ate: Optional[str]):
    """Filtra por created_at. Datas soltas (YYYY-MM-DD) viram intervalo inclusivo."""
    if de:
        q = q.gte("created_at", de)
    if ate:
        # Data sem hora: inclui o dia inteiro.
        q = q.lte("created_at", f"{ate}T23:59:59" if len(ate) == 10 else ate)
    return q


@router.get("", response_model=List[FichaVisitaOut])
def listar_fichas(
    imovel_id: Optional[str] = Query(None),
    cliente_id: Optional[str] = Query(None),
    status_filtro: Optional[str] = Query(None, alias="status"),
    de: Optional[str] = Query(None, description="Emitidas a partir de (YYYY-MM-DD)"),
    ate: Optional[str] = Query(None, description="Emitidas até (YYYY-MM-DD)"),
    apenas_disponiveis: bool = Query(False, description="Só fichas de imóveis disponíveis hoje"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    # O filtro de disponibilidade olha o cadastro ATUAL do imóvel (inner join),
    # não o snapshot da ficha.
    colunas = "*, imoveis!inner(disponibilidade)" if apenas_disponiveis else "*"
    q = supabase_admin.table("fichas_visita").select(colunas)
    if apenas_disponiveis:
        q = q.eq("imoveis.disponibilidade", "disponivel")
    if imovel_id:
        q = q.eq("imovel_id", imovel_id)
    if cliente_id:
        q = q.eq("cliente_id", cliente_id)
    if status_filtro:
        q = q.eq("status", status_filtro)
    q = _filtro_periodo(q, de, ate)
    inicio = (page - 1) * page_size
    res = q.order("created_at", desc=True).range(inicio, inicio + page_size - 1).execute()
    return res.data or []


@router.get("/resumo/por-imovel")
def resumo_por_imovel(
    de: Optional[str] = Query(None, description="Emitidas a partir de (YYYY-MM-DD)"),
    ate: Optional[str] = Query(None, description="Emitidas até (YYYY-MM-DD)"),
    apenas_disponiveis: bool = Query(False, description="Só imóveis disponíveis hoje"),
    current_user: dict = Depends(get_current_user),
):
    """Visitas agregadas por imóvel: total de fichas, quantas assinadas (visitas
    comprovadas), pendentes e a data da última. Canceladas ficam de fora."""
    colunas = ("imovel_id, imovel_codigo, imovel_endereco, imovel_bairro, "
               "imovel_cidade, status, created_at, assinada_em")
    if apenas_disponiveis:
        colunas += ", imoveis!inner(disponibilidade)"
    q = (
        supabase_admin.table("fichas_visita")
        .select(colunas)
        .neq("status", "cancelada")
    )
    if apenas_disponiveis:
        q = q.eq("imoveis.disponibilidade", "disponivel")
    q = _filtro_periodo(q, de, ate)
    fichas = q.execute().data or []

    por_imovel: dict = {}
    for f in fichas:
        chave = f.get("imovel_id")
        if not chave:
            continue
        grupo = por_imovel.setdefault(chave, {
            "imovel_id": chave,
            "imovel_codigo": f.get("imovel_codigo"),
            "imovel_endereco": f.get("imovel_endereco"),
            "imovel_bairro": f.get("imovel_bairro"),
            "imovel_cidade": f.get("imovel_cidade"),
            "total": 0,
            "assinadas": 0,
            "pendentes": 0,
            "ultima_em": None,
        })
        grupo["total"] += 1
        if f.get("status") == "assinada":
            grupo["assinadas"] += 1
        elif f.get("status") == "pendente":
            grupo["pendentes"] += 1
        criada = f.get("created_at")
        if criada and (grupo["ultima_em"] is None or criada > grupo["ultima_em"]):
            grupo["ultima_em"] = criada

    resumo = sorted(por_imovel.values(), key=lambda g: g["total"], reverse=True)
    return resumo


@router.get("/{ficha_id}", response_model=FichaVisitaOut)
def obter_ficha(ficha_id: str, current_user: dict = Depends(get_current_user)):
    return _buscar_ficha(ficha_id)


@router.get("/{ficha_id}/pdf")
def baixar_pdf(ficha_id: str, current_user: dict = Depends(get_current_user)):
    ficha = _buscar_ficha(ficha_id)
    if ficha.get("status") == "assinada" and ficha.get("pdf_path"):
        # Serve o PDF guardado — é dele que o hash foi calculado.
        pdf_bytes = baixar_documento(ficha["pdf_path"])
    else:
        # Pendente/cancelada: preview gerado na hora.
        pdf_bytes = gerar_ficha_visita_pdf(ficha, assinada=False)
    nome = f"ficha-visita-{ficha.get('imovel_codigo') or ficha_id[:8]}.pdf"
    return pdf_response(pdf_bytes, nome)


@router.post("/{ficha_id}/cancelar", response_model=FichaVisitaOut)
def cancelar_ficha(ficha_id: str, current_user: dict = Depends(require_admin)):
    ficha = _buscar_ficha(ficha_id)
    if ficha.get("status") == "assinada":
        raise HTTPException(status_code=409, detail="Ficha já assinada não pode ser cancelada.")
    res = (
        supabase_admin.table("fichas_visita")
        .update({"status": "cancelada", "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", ficha_id)
        .execute()
    )
    return res.data[0]


# ── Endpoints públicos (assinatura via token) ────────────────────────────────

def _ficha_assinavel(token: str) -> dict:
    """Busca a ficha pelo token e valida que ainda pode ser exibida/assinada.

    Ficha assinada passa (a página pública mostra a confirmação com o download
    do PDF) — o POST de assinatura rejeita explicitamente esse caso."""
    res = supabase_admin.table("fichas_visita").select("*").eq("token", token).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Link inválido.")
    ficha = res.data
    if ficha.get("status") == "assinada":
        return ficha
    if ficha.get("status") == "cancelada":
        raise HTTPException(status_code=410, detail="Esta ficha foi cancelada.")
    if token_expirado(ficha.get("token_expira_em")):
        supabase_admin.table("fichas_visita").update({"status": "expirada"}).eq("id", ficha["id"]).execute()
        raise HTTPException(status_code=410, detail="O link de assinatura expirou.")
    return ficha


@router.get("/assinar/{token}", response_model=FichaVisitaPublicaView)
@limiter.limit("30/minute")
def ver_ficha_publica(request: Request, token: str):
    return _ficha_assinavel(token)


@router.post("/assinar/{token}", response_model=FichaVisitaPublicaView)
@limiter.limit("10/minute")
def assinar_ficha(request: Request, token: str, body: FichaVisitaAssinaturaIn):
    ficha = _ficha_assinavel(token)
    if ficha.get("status") == "assinada":
        raise HTTPException(status_code=410, detail="Esta ficha já foi assinada.")
    if not body.aceite:
        raise HTTPException(status_code=400, detail="É necessário aceitar os termos para assinar.")

    agora = datetime.now(timezone.utc)
    ficha["assinada_em"] = agora.isoformat()
    ficha["assinante_ip"] = ip_do_request(request)
    ficha["assinante_xff"] = xff_bruto(request)
    ficha["assinante_user_agent"] = (request.headers.get("user-agent") or "")[:500]
    ficha["assinante_geo"] = (body.geo or "").strip() or None
    ficha["assinante_assinatura_png"] = body.assinatura_png
    ficha["assinante_cpf_confirmado"] = body.cpf.strip()
    ficha["documento_hash"] = _hash_documento(ficha)

    # Gera o PDF assinado e guarda no storage.
    pdf_bytes = gerar_ficha_visita_pdf(ficha, assinada=True)
    pdf_path = upload_pdf_bytes(pdf_bytes, f"fichas-visita/{ficha['id']}.pdf")

    update = {
        "status": "assinada",
        "assinada_em": ficha["assinada_em"],
        "assinante_ip": ficha["assinante_ip"],
        "assinante_xff": ficha["assinante_xff"],
        "assinante_user_agent": ficha["assinante_user_agent"],
        "assinante_geo": ficha["assinante_geo"],
        "assinante_assinatura_png": ficha["assinante_assinatura_png"],
        "assinante_cpf_confirmado": ficha["assinante_cpf_confirmado"],
        "documento_hash": ficha["documento_hash"],
        "pdf_path": pdf_path,
        "updated_at": agora.isoformat(),
    }
    res = supabase_admin.table("fichas_visita").update(update).eq("id", ficha["id"]).execute()
    ficha_assinada = res.data[0]

    # CRM: vincula/cadastra o visitante como cliente, completa o CPF do
    # cadastro e infere o perfil de busca a partir das visitas assinadas.
    # Best-effort — a assinatura já está consumada.
    try:
        atualizar_cadastro_pos_assinatura(ficha_assinada)
    except Exception:
        logger.exception("Falha ao atualizar cadastro/perfil do cliente após assinatura.")

    return ficha_assinada


@router.get("/assinar/{token}/pdf")
@limiter.limit("30/minute")
def baixar_pdf_publico(request: Request, token: str):
    """Download público do PDF assinado (logo após assinar, na tela de
    confirmação). Só funciona quando a ficha já está assinada."""
    res = supabase_admin.table("fichas_visita").select("*").eq("token", token).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Link inválido.")
    ficha = res.data
    if ficha.get("status") != "assinada" or not ficha.get("pdf_path"):
        raise HTTPException(status_code=409, detail="Ficha ainda não assinada.")
    pdf_bytes = baixar_documento(ficha["pdf_path"])
    nome = f"ficha-visita-{ficha.get('imovel_codigo') or ficha['id'][:8]}.pdf"
    return pdf_response(pdf_bytes, nome)
