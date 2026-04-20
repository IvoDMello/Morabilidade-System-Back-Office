"""Testes dos endpoints de tags."""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

TAG_DB = {
    "id": "tag-uuid-1",
    "nome": "Destaque",
    "cor": "#F59E0B",
    "created_at": "2025-01-01T00:00:00+00:00",
}


# ── GET /tags/ ────────────────────────────────────────────────────────────────

def test_listar_tags(client):
    db = make_db_mock(MagicMock(data=[TAG_DB]))

    with patch("app.routers.tags.supabase_admin", db):
        res = client.get("/tags/")

    assert res.status_code == 200
    assert res.json()[0]["nome"] == "Destaque"


def test_listar_tags_vazio(client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.tags.supabase_admin", db):
        res = client.get("/tags/")

    assert res.status_code == 200
    assert res.json() == []


# ── POST /tags/ ───────────────────────────────────────────────────────────────

def test_criar_tag_como_admin(admin_client):
    db = make_db_mock(MagicMock(data=[TAG_DB]))

    with patch("app.routers.tags.supabase_admin", db):
        res = admin_client.post("/tags/", json={"nome": "Destaque", "cor": "#F59E0B"})

    assert res.status_code == 201
    assert res.json()["nome"] == "Destaque"


def test_criar_tag_como_usuario_comum_proibido(client):
    res = client.post("/tags/", json={"nome": "Destaque"})
    assert res.status_code == 403


def test_criar_tag_sem_nome(admin_client):
    res = admin_client.post("/tags/", json={"cor": "#FF0000"})
    assert res.status_code == 422


# ── PUT /tags/{id} ────────────────────────────────────────────────────────────

def test_atualizar_tag_como_admin(admin_client):
    atualizada = {**TAG_DB, "nome": "Super Destaque"}
    db = make_db_mock(MagicMock(data=[atualizada]))

    with patch("app.routers.tags.supabase_admin", db):
        res = admin_client.put("/tags/tag-uuid-1", json={"nome": "Super Destaque"})

    assert res.status_code == 200
    assert res.json()["nome"] == "Super Destaque"


def test_atualizar_tag_nao_encontrada(admin_client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.tags.supabase_admin", db):
        res = admin_client.put("/tags/uuid-inexistente", json={"nome": "Teste"})

    assert res.status_code == 404


# ── DELETE /tags/{id} ─────────────────────────────────────────────────────────

def test_deletar_tag_como_admin(admin_client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.tags.supabase_admin", db):
        res = admin_client.delete("/tags/tag-uuid-1")

    assert res.status_code == 204


def test_deletar_tag_como_usuario_comum_proibido(client):
    res = client.delete("/tags/tag-uuid-1")
    assert res.status_code == 403
