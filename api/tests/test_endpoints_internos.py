"""Testes dos endpoints internos (X-Internal-Token) consumidos pelo CRM do WhatsApp:
GET /imoveis/interno/{codigo} e GET /clientes/interno/por-telefone/{telefone}."""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock
from tests.test_imoveis import IMOVEL_DB
from tests.test_clientes import CLIENTE_DB


# ── GET /imoveis/interno/{codigo} ─────────────────────────────────────────────

def test_imovel_interno_encontrado(client):
    # 2 execute(): lookup do id por código + _buscar_imovel.
    db = make_db_mock(MagicMock(data={"id": IMOVEL_DB["id"]}), MagicMock(data=IMOVEL_DB))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/interno/MB-00001")
    assert res.status_code == 200
    assert res.json()["codigo"] == "MB-00001"


def test_imovel_interno_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/interno/MB-99999")
    assert res.status_code == 404


def test_imovel_interno_exige_autenticacao(anon_client):
    # Sem X-Internal-Token e sem sessão → 401 (não vaza dados do catálogo).
    res = anon_client.get("/imoveis/interno/MB-00001")
    assert res.status_code == 401


# ── GET /clientes/interno/por-telefone/{telefone} ─────────────────────────────

def test_cliente_por_telefone_encontrado(client):
    # CLIENTE_DB.telefone = "11988887777"; buscamos com DDI 55 (formato do wa_id).
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/interno/por-telefone/5511988887777")
    assert res.status_code == 200
    assert res.json()["id"] == CLIENTE_DB["id"]


def test_cliente_por_telefone_sem_correspondencia(client):
    # Único candidato tem outro número → resposta 200 com corpo null.
    db = make_db_mock(MagicMock(data=[CLIENTE_DB]))
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/interno/por-telefone/5511900000000")
    assert res.status_code == 200
    assert res.json() is None


def test_cliente_por_telefone_curto_nao_consulta_banco(client):
    # Menos de 10 dígitos: retorna None antes de tocar o banco (sem falso positivo).
    db = make_db_mock()
    with patch("app.routers.clientes.supabase_admin", db):
        res = client.get("/clientes/interno/por-telefone/12345")
    assert res.status_code == 200
    assert res.json() is None
    db.execute.assert_not_called()


def test_cliente_por_telefone_exige_autenticacao(anon_client):
    res = anon_client.get("/clientes/interno/por-telefone/5511988887777")
    assert res.status_code == 401
