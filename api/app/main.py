import hmac

import sentry_sdk
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import settings

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        # Erros: captura 100%. Erro precisa ser visto inteiro pra debugar —
        # com amostragem você descobre o bug 1× e perde as 9 ocorrências
        # seguintes. Volume real de erros em prod é baixo, custo é baixo.
        sample_rate=1.0,
        # Performance traces: 10% basta pra ver padrão estatístico sem inflar
        # quota; aqui é amostragem honesta.
        traces_sample_rate=0.1,
        send_default_pii=False,
        integrations=[
            StarletteIntegration(transaction_style="url"),
            FastApiIntegration(),
        ],
    )
from app.limiter import limiter
from app.routers import analytics, autorizacoes, clientes, contato, fichas_visita, imoveis, imovel_acompanhamento, locacoes, oportunidades, tags, users
from app.auth.router import router as auth_router
from app.auth.dependencies import get_current_user
from app.database import supabase_admin

app = FastAPI(
    title="Morabilidade — API de Gestão Imobiliária",
    description="API interna do sistema de gestão. O site público consome os endpoints públicos para exibir imóveis em tempo real.",
    version="1.0.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — permite o painel administrativo e o site público consumirem a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Rotas de autenticação
app.include_router(auth_router, prefix="/auth", tags=["Autenticação"])

# Rotas do sistema interno (requerem autenticação)
app.include_router(users.router, prefix="/usuarios", tags=["Usuários"])
app.include_router(imoveis.router, prefix="/imoveis", tags=["Imóveis"])
app.include_router(imovel_acompanhamento.router, prefix="/imoveis", tags=["Acompanhamento"])
app.include_router(clientes.router, prefix="/clientes", tags=["Clientes"])
app.include_router(tags.router, prefix="/tags", tags=["Tags"])
app.include_router(contato.router, prefix="/contato", tags=["Site Público"])
app.include_router(oportunidades.router, tags=["Oportunidades"])
app.include_router(locacoes.router, prefix="/locacoes", tags=["Locações"])
app.include_router(fichas_visita.router, prefix="/fichas-visita", tags=["Fichas de Visita"])
app.include_router(autorizacoes.router, prefix="/autorizacoes", tags=["Autorizações"])
app.include_router(analytics.router, tags=["Analytics"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Morabilidade API"}


# Railway healthcheck (railway.toml: healthcheckPath = "/health") e Dockerfile
# HEALTHCHECK apontam pra esta rota. Sem ela todo deploy falha o healthcheck
# e o Railway mantém a versão anterior no ar — a nova nunca vai pro tráfego.
#
# Toca o Supabase pra não passar verde quando o banco está fora — foi
# exatamente o vetor da queda de 19/05/2026 (SSR amplificou indisponibilidade
# do banco que o healthcheck não percebia).
@app.get("/health", tags=["Health"], include_in_schema=False)
def health_endpoint():
    try:
        supabase_admin.table("imoveis").select("id", count="exact").limit(1).execute()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"db unreachable: {type(exc).__name__}")
    return {"status": "ok"}


@app.get("/stats", tags=["Health"])
def get_stats(current_user: dict = Depends(get_current_user)):
    """KPIs do painel inicial. Delegado para a RPC `stats_dashboard()`
    (migration 032) — 1 query em vez das 9 anteriores."""
    res = supabase_admin.rpc("stats_dashboard").execute()
    return res.data or {}


@app.get("/relatorios", tags=["Relatórios"])
def get_relatorios(current_user: dict = Depends(get_current_user)):
    """Agregações da aba Relatórios. Delegado para a RPC
    `relatorios_dashboard()` (migration 032) — agregação no Postgres em
    vez de SELECT * + Python."""
    res = supabase_admin.rpc("relatorios_dashboard").execute()
    dados = res.data or {}
    # Cliques no botão "Ver vídeo no Instagram" (total, excluindo bots). Query
    # barata fora da RPC pra não exigir nova migration do dashboard. Como os
    # logs são purgados aos 90 dias (migration 036), o total reflete ~90 dias.
    # Só enriquece quando a RPC trouxe dados (mantém o {} de erro/sem-dados).
    if dados:
        video = (
            supabase_admin.table("imovel_video_clicks")
            .select("id", count="exact")
            .eq("is_bot", False)
            .execute()
        )
        dados["video_clicks_total"] = video.count or 0
    return dados


# ─────────────────────────────────────────────────────────────────────────────
# DIAGNÓSTICO TEMPORÁRIO — REMOVER após calibrar o item 5 (IP de auditoria).
# Mostra a cadeia de proxy que a API realmente recebe em produção, para decidir
# de onde extrair o IP real do assinante (X-Envoy-External-Address vs X-Forwarded-For).
# Acesse pelo 4G do celular: /debug/ip-diagnostico?token=<DIAG_TOKEN>
# Token na URL (não exige login) porque só ecoa o IP de quem chama — nenhum dado
# de terceiro. Mesmo assim é gateado para não ficar aberto a varredura.
_DIAG_TOKEN = "diag_a7f3c9e1b2d4"


@app.get("/debug/ip-diagnostico", include_in_schema=False)
def ip_diagnostico(request: Request, token: str = ""):
    if not hmac.compare_digest(token, _DIAG_TOKEN):
        raise HTTPException(status_code=404, detail="Not found")
    xff = request.headers.get("x-forwarded-for")
    return {
        "client_host": request.client.host if request.client else None,
        "x_forwarded_for": xff,
        "x_forwarded_for_list": [p.strip() for p in xff.split(",")] if xff else [],
        "x_real_ip": request.headers.get("x-real-ip"),
        "x_envoy_external_address": request.headers.get("x-envoy-external-address"),
        "cf_connecting_ip": request.headers.get("cf-connecting-ip"),  # presente => Cloudflare na frente
        "forwarded": request.headers.get("forwarded"),  # RFC 7239
    }
