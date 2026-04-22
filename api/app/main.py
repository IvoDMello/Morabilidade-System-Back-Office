import sentry_sdk
from fastapi import FastAPI, Depends, Request
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
        traces_sample_rate=0.1,
        send_default_pii=False,
        integrations=[
            StarletteIntegration(transaction_style="url"),
            FastApiIntegration(),
        ],
    )
from app.limiter import limiter
from app.routers import imoveis, clientes, tags, users, contato
from app.auth.router import router as auth_router
from app.auth.dependencies import get_current_user
from app.database import supabase_admin

app = FastAPI(
    title="Morabilidade — API de Gestão Imobiliária",
    description="API interna do sistema de gestão. O site público consome os endpoints públicos para exibir imóveis em tempo real.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — permite o painel administrativo e o site público consumirem a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas de autenticação
app.include_router(auth_router, prefix="/auth", tags=["Autenticação"])

# Rotas do sistema interno (requerem autenticação)
app.include_router(users.router, prefix="/usuarios", tags=["Usuários"])
app.include_router(imoveis.router, prefix="/imoveis", tags=["Imóveis"])
app.include_router(clientes.router, prefix="/clientes", tags=["Clientes"])
app.include_router(tags.router, prefix="/tags", tags=["Tags"])
app.include_router(contato.router, prefix="/contato", tags=["Site Público"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Morabilidade API"}


@app.get("/stats", tags=["Health"])
def get_stats(current_user: dict = Depends(get_current_user)):
    total_imoveis = supabase_admin.table("imoveis").select("id", count="exact").execute().count or 0
    disponiveis = (supabase_admin.table("imoveis").select("id", count="exact")
                   .eq("disponibilidade", "disponivel").execute().count or 0)
    total_clientes = supabase_admin.table("clientes").select("id", count="exact").execute().count or 0
    em_negociacao = (supabase_admin.table("clientes").select("id", count="exact")
                     .eq("status", "em_negociacao").execute().count or 0)
    return {
        "total_imoveis": total_imoveis,
        "imoveis_disponiveis": disponiveis,
        "total_clientes": total_clientes,
        "clientes_em_negociacao": em_negociacao,
    }
