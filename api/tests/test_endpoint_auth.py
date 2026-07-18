"""Trava de segurança: todo endpoint não-público DEVE exigir autenticação.

Percorre a árvore de dependências de cada rota e garante que ela tenha
`get_current_user` ou `require_admin`, exceto as rotas explicitamente públicas
(allowlist abaixo). É a rede que pega a classe de bug do vazamento corrigido:
um endpoint novo que esquece o `Depends(...)` falha aqui, na CI, antes de ir pro ar.

Ao adicionar um endpoint público de propósito, inclua-o em PUBLIC_PATTERNS com um
comentário do porquê, assim a decisão fica explícita e revisável.
"""
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.main import app
from app.auth.dependencies import get_current_user, require_admin, require_admin_or_internal

AUTH_DEPS = {get_current_user, require_admin, require_admin_or_internal}

# Rotas públicas por design. Cada padrão é um substring do path.
PUBLIC_PATTERNS = (
    "/publico",          # site público: imóveis, tags, analytics /publico/*
    "/assinar/",         # assinatura por token: ficha de visita e autorização
    "/auth/login",       # login (emite o token)
    "/auth/refresh",     # renovação de sessão
    "/auth/recuperar-senha",  # reset de senha (204 sem oracle de enumeração)
    "/contato",          # formulário de contato do site
)

# Paths exatos públicos (health/infra/docs).
PUBLIC_EXACT = {
    "/", "/health",
    "/openapi.json", "/docs", "/redoc", "/docs/oauth2-redirect",
}

# Endpoints máquina-a-máquina: não usam get_current_user, mas exigem o header
# X-Cron-Token (hmac.compare_digest contra settings.cron_token). A trava
# test_endpoints_de_cron_exigem_token garante que o header continua obrigatório.
CRON_TOKEN_PATHS = {
    "/imoveis/internal/jobs/relatorio-30dias",
}


def _calls_da_dependant(dep: Dependant) -> set:
    """Coleta recursivamente todos os callables de dependência de uma rota."""
    calls = set()
    if dep.call is not None:
        calls.add(dep.call)
    for sub in dep.dependencies:
        calls |= _calls_da_dependant(sub)
    return calls


def _eh_publica(path: str) -> bool:
    return (
        path in PUBLIC_EXACT
        or path in CRON_TOKEN_PATHS
        or any(p in path for p in PUBLIC_PATTERNS)
    )


def _header_aliases(dep: Dependant) -> set:
    return {h.alias.lower() for h in dep.header_params}


def test_todo_endpoint_nao_publico_exige_autenticacao():
    desprotegidas = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if _eh_publica(route.path):
            continue
        calls = _calls_da_dependant(route.dependant)
        if not (calls & AUTH_DEPS):
            metodos = ",".join(sorted(route.methods - {"HEAD", "OPTIONS"}))
            desprotegidas.append(f"{metodos} {route.path}")

    assert not desprotegidas, (
        "Endpoints sem autenticação que não estão na allowlist pública:\n  "
        + "\n  ".join(sorted(desprotegidas))
        + "\n\nSe for público de propósito, adicione à PUBLIC_PATTERNS/PUBLIC_EXACT "
        "em tests/test_endpoint_auth.py com o motivo."
    )


def test_endpoints_de_cron_exigem_token():
    """Garante que cada path em CRON_TOKEN_PATHS realmente exige o X-Cron-Token
    senão o allowlist estaria liberando um endpoint sem nenhuma proteção."""
    por_path = {
        r.path: r for r in app.routes
        if isinstance(r, APIRoute) and r.path in CRON_TOKEN_PATHS
    }
    faltando = CRON_TOKEN_PATHS - set(por_path)
    assert not faltando, f"CRON_TOKEN_PATHS aponta para rotas inexistentes: {faltando}"
    for path, route in por_path.items():
        assert "x-cron-token" in _header_aliases(route.dependant), (
            f"{path} está no allowlist de cron mas não exige o header X-Cron-Token."
        )


def test_allowlist_publica_nao_tem_padrao_morto():
    """Cada padrão público deve casar com ao menos uma rota real, senão o
    allowlist acumula entradas obsoletas que mascaram regressões."""
    paths = [r.path for r in app.routes if isinstance(r, APIRoute)]
    for pattern in PUBLIC_PATTERNS:
        assert any(pattern in p for p in paths), (
            f"Padrão público '{pattern}' não casa com nenhuma rota, remova-o."
        )
