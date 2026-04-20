"""Testes dos endpoints de imóveis."""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

# ── Dados de teste ────────────────────────────────────────────────────────────

IMOVEL_DB = {
    "id": "imovel-uuid-1",
    "codigo": "IMO-00001",
    "tipo_negocio": "venda",
    "disponibilidade": "disponivel",
    "condicao": "usado",
    "cidade": "São Paulo",
    "bairro": "Pinheiros",
    "logradouro": "Rua dos Pinheiros",
    "numero": "100",
    "complemento": None,
    "cep": "05422-010",
    "tipo_imovel": "apartamento",
    "dormitorios": 2,
    "suites": 1,
    "banheiros": 2,
    "vagas_garagem": 1,
    "mobiliado": None,
    "andar": 5,
    "area_total": 80.0,
    "area_util": 70.0,
    "valor_venda": 650_000.0,
    "valor_locacao": None,
    "iptu_mensal": None,
    "condominio_mensal": None,
    "descricao": "Ótimo apartamento",
    "video_url": None,
    "corretor_id": None,
    "tag_ids": [],
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
    "imovel_fotos": [],
    "imovel_tags": [],
}

IMOVEL_PAYLOAD = {
    "tipo_negocio": "venda",
    "disponibilidade": "disponivel",
    "condicao": "usado",
    "cidade": "São Paulo",
    "bairro": "Pinheiros",
    "logradouro": "Rua dos Pinheiros",
    "tipo_imovel": "apartamento",
    "valor_venda": 650_000.0,
}


# ── GET /imoveis/ ──────────────────────────────────────────────────────────────

def test_listar_imoveis_retorna_lista(client):
    # 2 execute(): 1 count + 1 data
    count_res = MagicMock(count=1, data=[])
    data_res = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["codigo"] == "IMO-00001"
    assert res.headers["x-total-count"] == "1"


def test_listar_imoveis_vazio(client):
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/")

    assert res.status_code == 200
    assert res.json() == []
    assert res.headers["x-total-count"] == "0"


def test_listar_imoveis_exige_autenticacao(anon_client):
    res = anon_client.get("/imoveis/")
    assert res.status_code == 403


# ── GET /imoveis/{id} ─────────────────────────────────────────────────────────

def test_obter_imovel_existente(client):
    # 1 execute(): _buscar_imovel
    res_mock = MagicMock(data=IMOVEL_DB)
    db = make_db_mock(res_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/imovel-uuid-1")

    assert res.status_code == 200
    assert res.json()["codigo"] == "IMO-00001"
    assert res.json()["fotos"] == []
    assert res.json()["tags"] == []


def test_obter_imovel_nao_encontrado(client):
    res_mock = MagicMock(data=None)
    db = make_db_mock(res_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/uuid-inexistente")

    assert res.status_code == 404


# ── POST /imoveis/ ─────────────────────────────────────────────────────────────

def test_criar_imovel(client):
    # 3 execute(): rpc (codigo) + insert + _buscar_imovel
    codigo_mock = MagicMock(data=1)
    insert_mock = MagicMock(data=[IMOVEL_DB])
    detail_mock = MagicMock(data=IMOVEL_DB)
    db = make_db_mock(codigo_mock, insert_mock, detail_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.post("/imoveis/", json=IMOVEL_PAYLOAD)

    assert res.status_code == 201
    assert res.json()["codigo"] == "IMO-00001"


def test_criar_imovel_campos_obrigatorios_faltando(client):
    res = client.post("/imoveis/", json={"cidade": "SP"})
    assert res.status_code == 422


# ── PUT /imoveis/{id} ─────────────────────────────────────────────────────────

def test_atualizar_imovel(client):
    # 3 execute(): update + tag_delete (tag_ids=[] por padrão) + _buscar_imovel
    update_mock = MagicMock(data=[IMOVEL_DB])
    tag_del_mock = MagicMock(data=[])
    detail_mock = MagicMock(data={**IMOVEL_DB, "valor_venda": 700_000.0})
    db = make_db_mock(update_mock, tag_del_mock, detail_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.put(
            "/imoveis/imovel-uuid-1",
            json={**IMOVEL_PAYLOAD, "valor_venda": 700_000.0},
        )

    assert res.status_code == 200
    assert float(res.json()["valor_venda"]) == 700_000.0


# ── DELETE /imoveis/{id} ──────────────────────────────────────────────────────

def test_deletar_imovel(client):
    # 2 execute(): select fotos (data=[]) + delete imovel
    fotos_mock = MagicMock(data=[])
    delete_mock = MagicMock(data=[])
    db = make_db_mock(fotos_mock, delete_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.delete("/imoveis/imovel-uuid-1")

    assert res.status_code == 204
