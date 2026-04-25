"""Testes da camada de autenticação e RBAC."""
from unittest.mock import patch

from tests.conftest import ADMIN_USER, REGULAR_USER, make_db_mock


def _make_token(user_id: str, expired: bool = False) -> str:
    """
    Token opaco usado pelos testes — o Supabase Auth está mockado, então o conteúdo
    do token nunca é validado de fato. Basta ser uma string não vazia.
    """
    suffix = "expired" if expired else "valid"
    return f"fake.jwt.{user_id}.{suffix}"


# ── Health check ──────────────────────────────────────────────────────────────

def test_health_check(anon_client):
    res = anon_client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# ── Proteção de rotas ─────────────────────────────────────────────────────────

def test_rota_protegida_sem_token_retorna_403(anon_client):
    """HTTPBearer retorna 403 quando o header Authorization está ausente."""
    res = anon_client.get("/imoveis/")
    assert res.status_code == 403


def test_rota_protegida_token_invalido_retorna_401():
    """Token malformado deve retornar 401."""
    from app.main import app
    from fastapi.testclient import TestClient
    from unittest.mock import MagicMock

    app.dependency_overrides.clear()
    tc = TestClient(app, raise_server_exceptions=False)

    auth_mock = MagicMock()
    auth_mock.auth.get_user.side_effect = Exception("invalid token")

    with patch("app.auth.dependencies.supabase_admin", auth_mock):
        res = tc.get(
            "/imoveis/",
            headers={"Authorization": "Bearer token_completamente_invalido"},
        )
    assert res.status_code == 401


def test_rota_protegida_token_expirado_retorna_401():
    """Token expirado deve retornar 401."""
    from app.main import app
    from fastapi.testclient import TestClient
    from unittest.mock import MagicMock

    app.dependency_overrides.clear()
    tc = TestClient(app, raise_server_exceptions=False)

    token = _make_token("some-user-id", expired=True)

    auth_mock = MagicMock()
    auth_mock.auth.get_user.side_effect = Exception("token expired")

    with patch("app.auth.dependencies.supabase_admin", auth_mock):
        res = tc.get("/imoveis/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_token_valido_busca_usuario_no_banco():
    """Token válido deve buscar o perfil no Supabase e autorizar a request."""
    from app.main import app
    from app.auth.dependencies import get_current_user, require_admin
    from fastapi.testclient import TestClient
    from unittest.mock import MagicMock

    app.dependency_overrides.clear()
    tc = TestClient(app, raise_server_exceptions=False)

    token = _make_token(REGULAR_USER["id"])

    # auth.dependencies.supabase_admin (user lookup) + imoveis (count + data)
    user_res = MagicMock(data=REGULAR_USER)
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(user_res, count_res, data_res)

    with patch("app.auth.dependencies.supabase_admin", db), \
         patch("app.routers.imoveis.supabase_admin", db):
        res = tc.get("/imoveis/", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200


# ── RBAC ──────────────────────────────────────────────────────────────────────

def test_usuario_comum_nao_pode_criar_tag(client):
    res = client.post("/tags/", json={"nome": "Teste"})
    assert res.status_code == 403


def test_usuario_comum_nao_pode_listar_usuarios(client):
    res = client.get("/usuarios/")
    assert res.status_code == 403


def test_admin_pode_listar_usuarios(admin_client):
    from unittest.mock import MagicMock

    db = make_db_mock(MagicMock(data=[ADMIN_USER]))

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.get("/usuarios/")

    assert res.status_code == 200
    assert res.json()[0]["perfil"] == "admin"
