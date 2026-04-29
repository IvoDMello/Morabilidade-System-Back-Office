"""Testes dos endpoints de gerenciamento de usuários."""
from unittest.mock import MagicMock, patch

from tests.conftest import ADMIN_USER, REGULAR_USER, make_db_mock

USER_DB = {
    "id": "user-uuid-3",
    "nome_completo": "Novo Colaborador",
    "email": "colaborador@morabilidade.com",
    "perfil": "corretor",
    "telefone": None,
    "foto_url": None,
    "ativo": True,
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
}

USER_PAYLOAD = {
    "nome_completo": "Novo Colaborador",
    "email": "colaborador@morabilidade.com",
    "senha": "senha1234",
    "perfil": "corretor",
}


# ── GET /usuarios/ ────────────────────────────────────────────────────────────

def test_listar_usuarios_como_admin(admin_client):
    db = make_db_mock(MagicMock(data=[ADMIN_USER, USER_DB]))
    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.get("/usuarios/")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_listar_usuarios_sem_autenticacao_retorna_403(anon_client):
    res = anon_client.get("/usuarios/")
    assert res.status_code == 403


def test_listar_usuarios_como_usuario_comum_retorna_403(corretor_client):
    res = corretor_client.get("/usuarios/")
    assert res.status_code == 403


# ── GET /usuarios/me ──────────────────────────────────────────────────────────

def test_perfil_atual_retorna_usuario_logado(corretor_client):
    res = corretor_client.get("/usuarios/me")
    assert res.status_code == 200
    assert res.json()["email"] == REGULAR_USER["email"]


def test_perfil_atual_admin_retorna_perfil_admin(admin_client):
    res = admin_client.get("/usuarios/me")
    assert res.status_code == 200
    assert res.json()["perfil"] == "admin"


# ── GET /usuarios/{id} ────────────────────────────────────────────────────────

def test_obter_usuario_como_admin(admin_client):
    db = make_db_mock(MagicMock(data=USER_DB))
    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.get(f"/usuarios/{USER_DB['id']}")
    assert res.status_code == 200
    assert res.json()["email"] == USER_DB["email"]


def test_obter_usuario_nao_encontrado(admin_client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.get("/usuarios/uuid-inexistente")
    assert res.status_code == 404


# ── POST /usuarios/ ───────────────────────────────────────────────────────────

def test_criar_usuario_como_admin(admin_client):
    auth_mock = MagicMock()
    auth_mock.user.id = USER_DB["id"]

    db = MagicMock()
    db.auth.admin.create_user.return_value = auth_mock
    for method in ("table", "insert", "execute"):
        getattr(db, method).return_value = db
    db.execute.return_value = MagicMock(data=[USER_DB])

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.post("/usuarios/", json=USER_PAYLOAD)

    assert res.status_code == 201
    assert res.json()["email"] == USER_DB["email"]


def test_criar_usuario_como_comum_retorna_403(corretor_client):
    res = corretor_client.post("/usuarios/", json=USER_PAYLOAD)
    assert res.status_code == 403


def test_criar_usuario_email_invalido_retorna_422(admin_client):
    res = admin_client.post("/usuarios/", json={**USER_PAYLOAD, "email": "invalido"})
    assert res.status_code == 422


def test_criar_usuario_perfil_invalido_retorna_422(admin_client):
    res = admin_client.post("/usuarios/", json={**USER_PAYLOAD, "perfil": "superadmin"})
    assert res.status_code == 422


def test_criar_usuario_falha_no_auth_retorna_400(admin_client):
    db = MagicMock()
    db.auth.admin.create_user.side_effect = Exception("email já cadastrado")

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.post("/usuarios/", json=USER_PAYLOAD)

    assert res.status_code == 400


# ── PUT /usuarios/me ──────────────────────────────────────────────────────────

def test_atualizar_proprio_perfil(corretor_client):
    atualizado = {**REGULAR_USER, "nome_completo": "Novo Nome"}
    db = make_db_mock(MagicMock(data=[atualizado]))

    with patch("app.routers.users.supabase_admin", db):
        res = corretor_client.put("/usuarios/me", json={"nome_completo": "Novo Nome"})

    assert res.status_code == 200
    assert res.json()["nome_completo"] == "Novo Nome"


def test_atualizar_proprio_perfil_ignora_campo_perfil(corretor_client):
    """O endpoint /me não deve permitir mudança de perfil."""
    atualizado = {**REGULAR_USER, "nome_completo": "Outro Nome"}
    db = make_db_mock(MagicMock(data=[atualizado]))

    with patch("app.routers.users.supabase_admin", db):
        res = corretor_client.put("/usuarios/me", json={"nome_completo": "Outro Nome", "perfil": "admin"})

    assert res.status_code == 200
    # perfil não deve ter mudado — validado pelo exclude no router
    update_call_kwargs = db.update.call_args
    if update_call_kwargs:
        data_sent = update_call_kwargs[0][0] if update_call_kwargs[0] else {}
        assert "perfil" not in data_sent


# ── PUT /usuarios/{id} ────────────────────────────────────────────────────────

def test_atualizar_usuario_como_admin(admin_client):
    atualizado = {**USER_DB, "ativo": False}
    db = make_db_mock(MagicMock(data=[atualizado]))

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.put(f"/usuarios/{USER_DB['id']}", json={"ativo": False})

    assert res.status_code == 200
    assert res.json()["ativo"] is False


def test_atualizar_usuario_nao_encontrado(admin_client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.put("/usuarios/uuid-inexistente", json={"ativo": False})

    assert res.status_code == 404


# ── DELETE /usuarios/{id} ─────────────────────────────────────────────────────

def test_desativar_usuario_como_admin(admin_client):
    select_mock = MagicMock(data=[{"id": USER_DB["id"]}])
    update_mock = MagicMock(data=[{**USER_DB, "ativo": False}])
    db = make_db_mock(select_mock, update_mock)
    db.auth = MagicMock()

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.delete(f"/usuarios/{USER_DB['id']}")

    assert res.status_code == 204


def test_desativar_usuario_inexistente_retorna_204(admin_client):
    """DELETE é idempotente: deletar um usuário que não existe ainda retorna 204."""
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.users.supabase_admin", db):
        res = admin_client.delete("/usuarios/uuid-inexistente")

    assert res.status_code == 204


def test_desativar_usuario_como_comum_retorna_403(corretor_client):
    res = corretor_client.delete(f"/usuarios/{USER_DB['id']}")
    assert res.status_code == 403
