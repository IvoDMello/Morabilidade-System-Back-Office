import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
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


# ── Endpoints autenticados (dashboard interno) ────────────────────────────────

@router.get("/analytics/resumo", tags=["Analytics"])
def resumo_analytics(current_user: dict = Depends(get_current_user)):
    """
    Resumo de acesso ao site público.
    Retorna métricas para 7 e 30 dias + top 10 imóveis + série diária 30d.
    """
    resumo_7d = supabase_admin.rpc("analytics_resumo", {"dias": 7}).execute()
    resumo_30d = supabase_admin.rpc("analytics_resumo", {"dias": 30}).execute()
    top_imoveis = supabase_admin.rpc(
        "analytics_top_imoveis", {"dias": 30, "limite": 10}
    ).execute()
    serie = supabase_admin.rpc("analytics_serie_diaria", {"dias": 30}).execute()

    def _first(r) -> dict:
        return (r.data or [{}])[0] if r.data else {}

    r7 = _first(resumo_7d)
    r30 = _first(resumo_30d)

    return {
        "ultimos_7_dias": {
            "total_views": r7.get("total_views", 0),
            "sessoes_unicas": r7.get("sessoes_unicas", 0),
            "views_imovel": r7.get("views_imovel", 0),
        },
        "ultimos_30_dias": {
            "total_views": r30.get("total_views", 0),
            "sessoes_unicas": r30.get("sessoes_unicas", 0),
            "views_imovel": r30.get("views_imovel", 0),
        },
        "top_imoveis_30d": top_imoveis.data or [],
        "serie_diaria_30d": serie.data or [],
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

    row = (result.data or [{}])[0] if result.data else {}
    return {
        "total_views": row.get("total_views", 0),
        "views_30d": row.get("views_30d", 0),
        "views_7d": row.get("views_7d", 0),
        "sessoes_unicas_30d": row.get("sessoes_unicas_30d", 0),
    }
