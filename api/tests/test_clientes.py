"""Testes dos endpoints de clientes."""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

CLIENTE_DB = {
    "id": "cliente-uuid-1",
    "nome_completo": "Maria Oliveira",
    "email": "maria@email.com",
    "telefone": "11988887777",
    "cpf_cnpj": None,
    "data_nascimento": None,
    "telefone_secundario": None,
    "endereco": None,
    "cidade": "São Paulo",
    "estado": "SP",
    "profissao_empresa": None,
    "origem_lead": "whatsapp",
    "corretor_id": None,
    "status": "ativo",
    "tipo_cliente": "comprador",
    "renda_aproximada": None,
    "como_conheceu": None,
    "observacoes": None,
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
}

CLIENTE_PAYLOAD = {
    "nome_completo": "Maria Oliveira",
    "email": "maria@email.com",
    "telefone": "11988887777",
}


# ── GET /clientes/ ────────────────────────────────────────────────────────────

def test_listar_clientes(client):
    # 2 execute(): count + data
    count_res = MagicMock(count=1, data=[])
    data_res = MagicMock(count=1, data=[CLIENTE_DB])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/")

    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["nome_completo"] == "Maria Oliveira"
    assert res.headers["x-total-count"] == "1"


def test_listar_clientes_com_filtro_status(client):
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/?status=em_negociacao")

    assert res.status_code == 200
    assert res.json() == []


def test_listar_clientes_exige_autenticacao(anon_client):
    res = anon_client.get("/clientes/")
    assert res.status_code == 403


# ── GET /clientes/{id} ────────────────────────────────────────────────────────

def test_obter_cliente_existente(client):
    db = make_db_mock(MagicMock(data=CLIENTE_DB))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/cliente-uuid-1")

    assert res.status_code == 200
    assert res.json()["email"] == "maria@email.com"


def test_obter_cliente_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=None))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/uuid-inexistente")

    assert res.status_code == 404


# ── POST /clientes/ ───────────────────────────────────────────────────────────

def test_criar_cliente(client):
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.post("/clientes/", json=CLIENTE_PAYLOAD)

    assert res.status_code == 201
    assert res.json()["nome_completo"] == "Maria Oliveira"


def test_criar_cliente_email_invalido(client):
    res = client.post("/clientes/", json={**CLIENTE_PAYLOAD, "email": "invalido"})
    assert res.status_code == 422


def test_criar_cliente_campos_obrigatorios_faltando(client):
    res = client.post("/clientes/", json={"nome_completo": "Teste"})
    assert res.status_code == 422


# ── PUT /clientes/{id} ────────────────────────────────────────────────────────

def test_atualizar_cliente(client):
    atualizado = {**CLIENTE_DB, "status": "em_negociacao"}
    db = make_db_mock(MagicMock(data=[atualizado]))

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.put(
            "/clientes/cliente-uuid-1",
            json={**CLIENTE_PAYLOAD, "status": "em_negociacao"},
        )

    assert res.status_code == 200
    assert res.json()["status"] == "em_negociacao"


# ── DELETE /clientes/{id} ─────────────────────────────────────────────────────

def test_deletar_cliente(client):
    select_mock = MagicMock(data=[{"id": "cliente-uuid-1"}])
    delete_mock = MagicMock(data=[])
    db = make_db_mock(select_mock, delete_mock)

    with patch("app.routers.clientes.supabase_admin", db):
        res = client.delete("/clientes/cliente-uuid-1")

    assert res.status_code == 204
