"""Testes da camada de autenticação e RBAC."""
from unittest.mock import patch, MagicMock

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
    from fastapi.testclient import TestClient

    app.dependency_overrides.clear()
    tc = TestClient(app, raise_server_exceptions=False)

    token = _make_token(REGULAR_USER["id"])

    # auth.dependencies.supabase_admin (user lookup) + imoveis (count + data)
    user_res = MagicMock(data=REGULAR_USER)
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(user_res, count_res, data_res)

    # O get_user precisa retornar um objeto com .user.id para passar pela validação
    auth_mock = MagicMock()
    auth_mock.auth.get_user.return_value = MagicMock(user=MagicMock(id=REGULAR_USER["id"]))
    auth_mock.table = db.table

    with patch("app.auth.dependencies.supabase_admin", auth_mock), \
         patch("app.routers.imoveis.supabase_admin", db):
        res = tc.get("/imoveis/", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200


# ── RBAC ──────────────────────────────────────────────────────────────────────

def test_usuario_comum_nao_pode_criar_tag(corretor_client):
    res = corretor_client.post("/tags/", json={"nome": "Teste"})
    assert res.status_code == 403


def test_usuario_comum_nao_pode_listar_usuarios(corretor_client):
    res = corretor_client.get("/usuarios/")
    assert res.status_code == 403


def test_admin_pode_listar_usuarios(admin_client):
    db = make_db_mock(MagicMock(data=[ADMIN_USER]))

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.get("/usuarios/")

    assert res.status_code == 200
    assert res.json()[0]["perfil"] == "admin"


# ── POST /auth/login ──────────────────────────────────────────────────────────

def test_login_credenciais_validas_retorna_token(anon_client):
    session_mock = MagicMock()
    session_mock.session.access_token = "token-valido-abc"
    session_mock.user.id = REGULAR_USER["id"]
    session_mock.user.email = REGULAR_USER["email"]

    supabase_mock = MagicMock()
    supabase_mock.auth.sign_in_with_password.return_value = session_mock

    with patch("app.auth.router.supabase", supabase_mock):
        res = anon_client.post(
            "/auth/login",
            json={"email": "usuario@teste.com", "senha": "senha1234"},
        )

    assert res.status_code == 200
    assert res.json()["access_token"] == "token-valido-abc"
    assert res.json()["token_type"] == "bearer"


def test_login_credenciais_invalidas_retorna_401(anon_client):
    supabase_mock = MagicMock()
    supabase_mock.auth.sign_in_with_password.side_effect = Exception("Invalid credentials")

    with patch("app.auth.router.supabase", supabase_mock):
        res = anon_client.post(
            "/auth/login",
            json={"email": "usuario@teste.com", "senha": "senha-errada"},
        )

    assert res.status_code == 401


def test_login_sem_sessao_retorna_401(anon_client):
    session_mock = MagicMock()
    session_mock.session = None

    supabase_mock = MagicMock()
    supabase_mock.auth.sign_in_with_password.return_value = session_mock

    with patch("app.auth.router.supabase", supabase_mock):
        res = anon_client.post(
            "/auth/login",
            json={"email": "usuario@teste.com", "senha": "senha1234"},
        )

    assert res.status_code == 401


def test_login_email_invalido_retorna_422(anon_client):
    res = anon_client.post(
        "/auth/login",
        json={"email": "nao-e-email", "senha": "senha1234"},
    )
    assert res.status_code == 422


def test_login_payload_incompleto_retorna_422(anon_client):
    res = anon_client.post("/auth/login", json={"email": "usuario@teste.com"})
    assert res.status_code == 422


# ── POST /auth/logout ─────────────────────────────────────────────────────────

def test_logout_usuario_autenticado_retorna_204(client):
    supabase_admin_mock = MagicMock()
    with patch("app.auth.router.supabase_admin", supabase_admin_mock):
        res = client.post("/auth/logout")
    assert res.status_code == 204


def test_logout_sem_autenticacao_retorna_403(anon_client):
    res = anon_client.post("/auth/logout")
    assert res.status_code == 403


def test_logout_falha_no_supabase_ainda_retorna_204(client):
    """Erro ao deslogar no Supabase não deve expor 500 ao cliente."""
    supabase_admin_mock = MagicMock()
    supabase_admin_mock.auth.admin.sign_out.side_effect = Exception("network error")

    with patch("app.auth.router.supabase_admin", supabase_admin_mock):
        res = client.post("/auth/logout")

    assert res.status_code == 204


# ── POST /auth/recuperar-senha ────────────────────────────────────────────────

def test_recuperar_senha_email_valido_retorna_204(anon_client):
    supabase_mock = MagicMock()
    with patch("app.auth.router.supabase", supabase_mock):
        res = anon_client.post(
            "/auth/recuperar-senha",
            json={"email": "usuario@teste.com"},
        )
    assert res.status_code == 204


def test_recuperar_senha_email_inexistente_ainda_retorna_204(anon_client):
    """Não deve revelar se o e-mail existe ou não."""
    supabase_mock = MagicMock()
    supabase_mock.auth.reset_password_email.side_effect = Exception("user not found")

    with patch("app.auth.router.supabase", supabase_mock):
        res = anon_client.post(
            "/auth/recuperar-senha",
            json={"email": "naoexiste@teste.com"},
        )

    assert res.status_code == 204


def test_recuperar_senha_email_invalido_retorna_422(anon_client):
    res = anon_client.post("/auth/recuperar-senha", json={"email": "nao-e-email"})
    assert res.status_code == 422
