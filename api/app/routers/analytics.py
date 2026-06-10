import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.database import supabase_admin
from app.limiter import limiter

router = APIRouter()


# User-agents que devemos ignorar pra não inflar métricas.
# Cobre crawlers (Google, Bing), previews de redes sociais (WhatsApp, Facebook,
# Twitter, LinkedIn) e ferramentas de automação. Mantemos amplo de propósito —
# preferimos perder algumas visitas reais a poluir o dashboard com bots.
_BOT_RE = re.compile(
    r"bot|crawler|spider|slurp|bingpreview|facebookexternalhit|"
    r"twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|"
    r"headlesschrome|phantomjs|selenium|puppeteer|playwright|"
    r"lighthouse|gtmetrix|pingdom|uptimerobot|curl|wget|python-requests",
    re.IGNORECASE,
)


def _is_bot(user_agent: Optional[str]) -> bool:
    if not user_agent:
        return True  # Sem UA = bot mal-comportado
    return bool(_BOT_RE.search(user_agent))


class TrackPayload(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=128)
    path: str = Field(..., max_length=500)
    imovel_codigo: Optional[str] = Field(default=None, max_length=20)
    referrer: Optional[str] = Field(default=None, max_length=500)


@router.post("/publico/track", status_code=status.HTTP_204_NO_CONTENT, tags=["Analytics"])
@limiter.limit("120/minute")
def track_page_view(request: Request, body: TrackPayload):
    """
    Recebe um evento de visualização do site público.
    Chamado via navigator.sendBeacon no client — fire-and-forget.

    Privacidade: não armazenamos IP. user_agent fica truncado em 500 chars.
    Bots conhecidos são marcados is_bot=true (mas ainda inseridos, pra debug).
    """
    user_agent = (request.headers.get("user-agent") or "")[:500] or None

    # Resolve imovel_codigo → imovel_id (opcional)
    imovel_id = None
    if body.imovel_codigo:
        # Aceitamos só o formato MB-XXXXX pra não fazer lookup de string arbitrária
        if re.fullmatch(r"MB-\d{5}", body.imovel_codigo):
            res = (
                supabase_admin.table("imoveis")
                .select("id")
                .eq("codigo", body.imovel_codigo)
                .limit(1)
                .execute()
            )
            if res.data:
                imovel_id = res.data[0]["id"]

    supabase_admin.table("page_views").insert({
        "session_id": body.session_id,
        "path": body.path,
        "imovel_id": imovel_id,
        "imovel_codigo": body.imovel_codigo if imovel_id else None,
        "referrer": body.referrer,
        "user_agent": user_agent,
        "is_bot": _is_bot(user_agent),
    }).execute()


# ── Endpoints públicos: busca, favorito, share ────────────────────────────────

_CODIGO_RE = re.compile(r"^MB-\d{5}$")


def _resolve_imovel_id(codigo: Optional[str]) -> Optional[str]:
    if not codigo or not _CODIGO_RE.fullmatch(codigo):
        return None
    res = (
        supabase_admin.table("imoveis")
        .select("id")
        .eq("codigo", codigo)
        .limit(1)
        .execute()
    )
    return res.data[0]["id"] if res.data else None


class BuscaPayload(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=128)
    termo: Optional[str] = Field(default=None, max_length=200)
    filtros: dict[str, Any] = Field(default_factory=dict)
    resultados_count: int = Field(..., ge=0)


@router.post("/publico/busca", status_code=status.HTTP_204_NO_CONTENT, tags=["Analytics"])
@limiter.limit("120/minute")
def track_busca(request: Request, body: BuscaPayload):
    user_agent = (request.headers.get("user-agent") or "")[:500] or None
    termo = body.termo.strip() if body.termo else None
    supabase_admin.table("search_events").insert({
        "session_id": body.session_id,
        "termo": termo if termo else None,
        "filtros": body.filtros,
        "resultados_count": body.resultados_count,
        "is_bot": _is_bot(user_agent),
    }).execute()


class FavoritoPayload(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=128)
    imovel_codigo: str = Field(..., max_length=20)
    acao: str = Field(..., pattern=r"^(add|remove)$")


@router.post("/publico/favorito", status_code=status.HTTP_204_NO_CONTENT, tags=["Analytics"])
@limiter.limit("120/minute")
def track_favorito(request: Request, body: FavoritoPayload):
    imovel_id = _resolve_imovel_id(body.imovel_codigo)
    if not imovel_id:
        return  # silencioso: código inválido não derruba o site
    user_agent = (request.headers.get("user-agent") or "")[:500] or None
    supabase_admin.table("imovel_favoritos").insert({
        "session_id": body.session_id,
        "imovel_id": imovel_id,
        "acao": body.acao,
        "is_bot": _is_bot(user_agent),
    }).execute()


class SharePayload(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=128)
    imovel_codigo: str = Field(..., max_length=20)
    canal: Optional[str] = Field(default=None, max_length=20)


@router.post("/publico/share", status_code=status.HTTP_204_NO_CONTENT, tags=["Analytics"])
@limiter.limit("120/minute")
def track_share(request: Request, body: SharePayload):
    imovel_id = _resolve_imovel_id(body.imovel_codigo)
    if not imovel_id:
        return
    user_agent = (request.headers.get("user-agent") or "")[:500] or None
    canal = body.canal if body.canal in ("whatsapp", "web_share", "copy_link") else None
    supabase_admin.table("imovel_shares").insert({
        "session_id": body.session_id,
        "imovel_id": imovel_id,
        "canal": canal,
        "is_bot": _is_bot(user_agent),
    }).execute()


class VideoPayload(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=128)
    imovel_codigo: str = Field(..., max_length=20)


@router.post("/publico/video", status_code=status.HTTP_204_NO_CONTENT, tags=["Analytics"])
@limiter.limit("120/minute")
def track_video(request: Request, body: VideoPayload):
    """Clique no botão 'Ver vídeo no Instagram' da página do imóvel."""
    imovel_id = _resolve_imovel_id(body.imovel_codigo)
    if not imovel_id:
        return  # silencioso: código inválido não derruba o site
    user_agent = (request.headers.get("user-agent") or "")[:500] or None
    supabase_admin.table("imovel_video_clicks").insert({
        "session_id": body.session_id,
        "imovel_id": imovel_id,
        "is_bot": _is_bot(user_agent),
    }).execute()


# ── Endpoints autenticados (dashboard interno) ────────────────────────────────

@router.get("/analytics/dashboard", tags=["Analytics"])
def analytics_dashboard(
    periodo: int = Query(30, description="Janela em dias (7, 30, 90, 365)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Resumo completo da aba /audiencia. Devolve KPIs (com delta vs período
    anterior), série diária, funil, origem do tráfego, top imóveis, bairros,
    dispositivos, heatmap, termos e buscas sem resultado em uma única chamada.
    """
    if periodo not in (7, 30, 90, 365):
        periodo = 30

    def _first(r) -> dict:
        return (r.data or [{}])[0] if r.data else {}

    kpis_atual = _first(supabase_admin.rpc("analytics_kpis", {"dias": periodo, "prev": False}).execute())
    kpis_prev = _first(supabase_admin.rpc("analytics_kpis", {"dias": periodo, "prev": True}).execute())

    def _delta(atual: int, anterior: int) -> Optional[float]:
        if not anterior:
            return None
        return round(((atual - anterior) / anterior) * 100, 1)

    kpis = {
        "visitantes_unicos": {
            "valor": kpis_atual.get("visitantes_unicos", 0),
            "delta": _delta(kpis_atual.get("visitantes_unicos", 0), kpis_prev.get("visitantes_unicos", 0)),
        },
        "vistas_imovel": {
            "valor": kpis_atual.get("vistas_imovel", 0),
            "delta": _delta(kpis_atual.get("vistas_imovel", 0), kpis_prev.get("vistas_imovel", 0)),
        },
        "buscas": {
            "valor": kpis_atual.get("buscas", 0),
            "delta": _delta(kpis_atual.get("buscas", 0), kpis_prev.get("buscas", 0)),
        },
        "favoritos": {
            "valor": kpis_atual.get("favoritos", 0),
            "delta": _delta(kpis_atual.get("favoritos", 0), kpis_prev.get("favoritos", 0)),
        },
    }

    return {
        "periodo": periodo,
        "kpis": kpis,
        "serie": supabase_admin.rpc("analytics_serie", {"dias": periodo}).execute().data or [],
        "funil": _first(supabase_admin.rpc("analytics_funil", {"dias": periodo}).execute()),
        "origem": supabase_admin.rpc("analytics_origem", {"dias": periodo}).execute().data or [],
        "top_imoveis": supabase_admin.rpc(
            "analytics_top_imoveis_v2", {"dias": periodo, "limite": 7}
        ).execute().data or [],
        "bairros": supabase_admin.rpc(
            "analytics_bairros", {"dias": periodo, "limite": 8}
        ).execute().data or [],
        "dispositivos": supabase_admin.rpc(
            "analytics_dispositivos", {"dias": periodo}
        ).execute().data or [],
        "heatmap": supabase_admin.rpc("analytics_heatmap", {"dias": periodo}).execute().data or [],
        "termos": supabase_admin.rpc(
            "analytics_termos", {"dias": periodo, "limite": 6}
        ).execute().data or [],
        "buscas_vazias": supabase_admin.rpc(
            "analytics_buscas_vazias", {"dias": periodo, "limite": 4}
        ).execute().data or [],
    }


@router.get("/analytics/imovel/{codigo}", tags=["Analytics"])
def analytics_imovel(codigo: str, current_user: dict = Depends(get_current_user)):
    """Contagem de views (total/30d/7d) de um imóvel específico."""
    imovel_resp = (
        supabase_admin.table("imoveis")
        .select("id")
        .eq("codigo", codigo)
        .limit(1)
        .execute()
    )
    if not imovel_resp.data:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    imovel_id = imovel_resp.data[0]["id"]
    result = supabase_admin.rpc(
        "analytics_imovel", {"p_imovel_id": imovel_id}
    ).execute()

    # Cliques no botão "Ver vídeo no Instagram" (total, excluindo bots).
    video = (
        supabase_admin.table("imovel_video_clicks")
        .select("id", count="exact")
        .eq("imovel_id", imovel_id)
        .eq("is_bot", False)
        .execute()
    )

    row = (result.data or [{}])[0] if result.data else {}
    return {
        "total_views": row.get("total_views", 0),
        "views_30d": row.get("views_30d", 0),
        "views_7d": row.get("views_7d", 0),
        "sessoes_unicas_30d": row.get("sessoes_unicas_30d", 0),
        "video_clicks_total": video.count or 0,
    }
