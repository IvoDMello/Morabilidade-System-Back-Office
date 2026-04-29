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
from app.routers import clientes, contato, imoveis, oportunidades, tags, users
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
app.include_router(oportunidades.router, tags=["Oportunidades"])


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

    # Agregações para os gráficos do dashboard.
    # Não há GROUP BY no PostgREST, então puxamos só os campos relevantes
    # e contamos no Python — escala bem até alguns milhares de clientes.
    clientes_raw = (
        supabase_admin.table("clientes")
        .select("status, origem_lead")
        .execute()
        .data
        or []
    )
    por_status: dict = {}
    por_origem: dict = {}
    for c in clientes_raw:
        s = c.get("status") or "indefinido"
        o = c.get("origem_lead") or "indefinido"
        por_status[s] = por_status.get(s, 0) + 1
        por_origem[o] = por_origem.get(o, 0) + 1

    # Imóvel mais antigo AINDA NO PORTFÓLIO (disponível ou reservado).
    # Vendidos/locados ficam de fora — eles não são mais portfólio ativo.
    mais_antigo_resp = (
        supabase_admin.table("imoveis")
        .select("codigo, created_at")
        .in_("disponibilidade", ["disponivel", "reservado"])
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    imovel_mais_antigo = (mais_antigo_resp.data or [None])[0]

    # Imóveis reservados (pipeline — cada um conta muito num portfólio pequeno).
    imoveis_reservados = (
        supabase_admin.table("imoveis").select("id", count="exact")
        .eq("disponibilidade", "reservado").execute().count or 0
    )

    # Imóveis sem foto — críticos para conversão no site público.
    # Estratégia: puxar todos os ids de imóveis vs ids que têm fotos, diferença é o que falta.
    todos_ids_resp = supabase_admin.table("imoveis").select("id").execute()
    ids_imoveis = {row["id"] for row in (todos_ids_resp.data or [])}
    com_foto_resp = supabase_admin.table("imovel_fotos").select("imovel_id").execute()
    ids_com_foto = {row["imovel_id"] for row in (com_foto_resp.data or [])}
    imoveis_sem_foto = len(ids_imoveis - ids_com_foto)

    # Leads novos nos últimos 7 dias (pulso semanal).
    from datetime import datetime, timedelta, timezone
    sete_dias_atras = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    leads_7d = (
        supabase_admin.table("clientes").select("id", count="exact")
        .gte("created_at", sete_dias_atras).execute().count or 0
    )

    return {
        "total_imoveis": total_imoveis,
        "imoveis_disponiveis": disponiveis,
        "imoveis_reservados": imoveis_reservados,
        "imoveis_sem_foto": imoveis_sem_foto,
        "total_clientes": total_clientes,
        "clientes_em_negociacao": em_negociacao,
        "leads_ultimos_7_dias": leads_7d,
        "clientes_por_status": por_status,
        "clientes_por_origem": por_origem,
        "imovel_mais_antigo": imovel_mais_antigo,
    }
