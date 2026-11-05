import re
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.database import supabase_admin
from app.limiter import limiter
from app.routers.radar import bairro_canonico

router = APIRouter()


# User-agents que devemos ignorar pra não inflar métricas.
# Cobre crawlers (Google, Bing), previews de redes sociais (WhatsApp, Facebook,
# Twitter, LinkedIn) e ferramentas de automação. Mantemos amplo de propósito
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
    Chamado via navigator.sendBeacon no client, fire-and-forget.

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
    """Clique num dos botões de vídeo (Instagram/YouTube) da página do imóvel."""
    imovel_id = _resolve_imovel_id(body.imovel_codigo)
    if not imovel_id:
        return  # silencioso: código inválido não derruba o site
    user_agent = (request.headers.get("user-agent") or "")[:500] or None
    supabase_admin.table("imovel_video_clicks").insert({
        "session_id": body.session_id,
        "imovel_id": imovel_id,
        "is_bot": _is_bot(user_agent),
    }).execute()


class MoraMetricaPayload(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=128)
    tipo: str = Field(..., pattern=r"^(predio|unidade|rua|bairro|ambiguo|nenhum|erro)$")
    # Onde a busca caiu, para o ranking de bairros e ruas. Nunca número nem unidade.
    cl: Optional[int] = Field(default=None, ge=1, le=9_999_999)
    bairro: Optional[str] = Field(default=None, max_length=80)


# Buscas que caem numa rua; a de bairro tem só o bairro.
_TIPOS_COM_RUA = ("predio", "unidade", "rua")


@router.post("/publico/morametrica", status_code=status.HTTP_204_NO_CONTENT, tags=["Analytics"])
@limiter.limit("120/minute")
def track_morametrica(request: Request, body: MoraMetricaPayload):
    """
    Busca feita na MoraMétrica: o tipo de resultado e, quando a busca achou
    algo, a rua (cl) e o bairro. Nunca o número do prédio nem a unidade.

    O bairro só é gravado se existir na base, com a grafia dela: o endpoint é
    público, e texto inventado não entra no ranking. Sem bairro válido, a rua
    também fica de fora.
    """
    user_agent = (request.headers.get("user-agent") or "")[:500] or None
    linha = {
        "session_id": body.session_id,
        "tipo": body.tipo,
        "is_bot": _is_bot(user_agent),
    }
    bairro = bairro_canonico(body.bairro) if body.tipo in (*_TIPOS_COM_RUA, "bairro") else None
    if bairro:
        linha["bairro"] = bairro
        if body.cl and body.tipo in _TIPOS_COM_RUA:
            linha["cl"] = body.cl
    supabase_admin.table("morametrica_buscas").insert(linha).execute()


# ── Endpoints autenticados (dashboard interno) ────────────────────────────────

_TZ_BR = ZoneInfo("America/Sao_Paulo")

# Os eventos brutos são apagados após 90 dias (purge_old_logs, migration 032):
# os painéis de detalhe não enxergam além disso.
_DIAS_DETALHE = 90

# Ranking da MoraMétrica: bairros, e ruas de cada um deles.
_TOP_BAIRROS_MORAMETRICA = 15
_TOP_RUAS_MORAMETRICA = 15

# Colunas de analytics_diario somadas nos cards.
_KPIS_SITE = ("visitas", "acessos", "vistas_imovel", "buscas", "favoritos")
_KPIS_MORAMETRICA = {
    "visitas": "mm_visitas",
    "acessos": "mm_acessos",
    "buscas": "mm_buscas",
    "sem_resultado": "mm_sem_resultado",
}


def _delta(atual: int, anterior: int) -> Optional[float]:
    if not anterior:
        return None
    return round(((atual - anterior) / anterior) * 100, 1)


@router.get("/analytics/dashboard", tags=["Analytics"])
def analytics_dashboard(
    periodo: int = Query(30, description="Janela em dias (7, 30, 90, 365)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Resumo completo da aba /audiencia em uma única chamada.

    As contagens (cards do site e da MoraMétrica, série, origem) vêm de
    analytics_dias, o histórico diário que não é apagado (migration 060). O
    período são dias fechados terminando ontem, comparados com o mesmo número
    de dias antes deles; o dia corrente vem à parte em `hoje`, para não
    comparar um dia pela metade com dias inteiros. Se o histórico não cobre o
    período anterior inteiro, o delta é None.

    Os painéis de detalhe (funil, imóveis, bairros, dispositivos, horários,
    termos, bairros e ruas da MoraMétrica) leem os eventos brutos, limitados
    aos últimos 90 dias.

    Os eventos entram na hora em que acontecem, e esta leitura é feita no
    momento da chamada: `atualizado_em` (hora de Brasília) é até quando o
    dia corrente está contado.
    """
    if periodo not in (7, 30, 90, 365):
        periodo = 30

    agora = datetime.now(_TZ_BR)
    hoje = agora.date()
    fim = hoje - timedelta(days=1)
    inicio = fim - timedelta(days=periodo - 1)
    inicio_anterior = inicio - timedelta(days=periodo)

    dias = supabase_admin.rpc(
        "analytics_dias", {"p_desde": inicio_anterior.isoformat(), "p_ate": hoje.isoformat()}
    ).execute().data or []
    atual = [d for d in dias if inicio.isoformat() <= d["dia"] <= fim.isoformat()]
    anterior = [d for d in dias if d["dia"] < inicio.isoformat()]
    linha_hoje = next((d for d in dias if d["dia"] == hoje.isoformat()), None)
    # O histórico tem uma linha por dia desde que começou, então a primeira
    # linha diz onde ele começa dentro da janela pedida.
    historico_desde = min((d["dia"] for d in dias), default=None)
    compara = historico_desde is not None and historico_desde <= inicio_anterior.isoformat()

    def _kpi(campo: str) -> dict:
        valor = sum(d.get(campo, 0) for d in atual)
        anterior_total = sum(d.get(campo, 0) for d in anterior)
        return {"valor": valor, "delta": _delta(valor, anterior_total) if compara else None}

    origens: dict[str, int] = {}
    for d in atual:
        for origem, n in (d.get("origens") or {}).items():
            origens[origem] = origens.get(origem, 0) + n

    def _first(r) -> dict:
        return (r.data or [{}])[0] if r.data else {}

    detalhe = min(periodo, _DIAS_DETALHE)

    return {
        "periodo": periodo,
        "atualizado_em": agora.isoformat(timespec="seconds"),
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
        "historico_desde": historico_desde,
        "detalhe_dias": detalhe,
        "kpis": {campo: _kpi(campo) for campo in _KPIS_SITE},
        "morametrica": {chave: _kpi(campo) for chave, campo in _KPIS_MORAMETRICA.items()},
        "hoje": (
            {campo: linha_hoje.get(campo, 0) for campo in (*_KPIS_SITE, *_KPIS_MORAMETRICA.values())}
            if linha_hoje else None
        ),
        "serie": [
            {
                "dia": d["dia"],
                "visitas": d.get("visitas", 0),
                "acessos": d.get("acessos", 0),
                "mm_visitas": d.get("mm_visitas", 0),
                "mm_acessos": d.get("mm_acessos", 0),
                "mm_buscas": d.get("mm_buscas", 0),
            }
            for d in atual
        ],
        "origem": sorted(
            ({"origem": o, "total": n} for o, n in origens.items()),
            key=lambda o: o["total"], reverse=True,
        ),
        "funil": _first(supabase_admin.rpc("analytics_funil", {"dias": detalhe}).execute()),
        "top_imoveis": supabase_admin.rpc(
            "analytics_top_imoveis_v2", {"dias": detalhe, "limite": 7}
        ).execute().data or [],
        "bairros": supabase_admin.rpc(
            "analytics_bairros", {"dias": detalhe, "limite": 8}
        ).execute().data or [],
        "dispositivos": supabase_admin.rpc(
            "analytics_dispositivos", {"dias": detalhe}
        ).execute().data or [],
        "heatmap": supabase_admin.rpc("analytics_heatmap", {"dias": detalhe}).execute().data or [],
        "termos": supabase_admin.rpc(
            "analytics_termos", {"dias": detalhe, "limite": 6}
        ).execute().data or [],
        "buscas_vazias": supabase_admin.rpc(
            "analytics_buscas_vazias", {"dias": detalhe, "limite": 4}
        ).execute().data or [],
        "morametrica_bairros": supabase_admin.rpc(
            "analytics_morametrica_bairros",
            {"dias": detalhe, "limite": _TOP_BAIRROS_MORAMETRICA, "limite_ruas": _TOP_RUAS_MORAMETRICA},
        ).execute().data or [],
    }


@router.get("/analytics/morametrica/dia", tags=["Analytics"])
def analytics_morametrica_dia(
    dia: date = Query(..., description="Dia no fuso de Brasília (AAAA-MM-DD)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Uso da MoraMétrica num dia só. Um dia passado vem inteiro, da meia-noite
    à meia-noite de Brasília; o dia de hoje vem até `atualizado_em`.
    `numeros` é None quando o dia é anterior ao histórico.
    """
    agora = datetime.now(_TZ_BR)
    hoje = agora.date()
    if dia > hoje:
        raise HTTPException(status_code=422, detail="O dia ainda não chegou.")

    linha = next(iter(supabase_admin.rpc(
        "analytics_dias", {"p_desde": dia.isoformat(), "p_ate": dia.isoformat()}
    ).execute().data or []), None)

    return {
        "dia": dia.isoformat(),
        "completo": dia < hoje,
        "atualizado_em": agora.isoformat(timespec="seconds"),
        "numeros": (
            {chave: linha.get(campo, 0) for chave, campo in _KPIS_MORAMETRICA.items()}
            if linha else None
        ),
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
