from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import imoveis, clientes, tags, users
from app.auth.router import router as auth_router

app = FastAPI(
    title="Morabilidade — API de Gestão Imobiliária",
    description="API interna do sistema de gestão. O site público consome os endpoints públicos para exibir imóveis em tempo real.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False,
)

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


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Morabilidade API"}
