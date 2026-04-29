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


# ── GET /imoveis/exportar ─────────────────────────────────────────────────────

def test_exportar_imoveis_csv(client):
    primeira_pagina = MagicMock(data=[IMOVEL_DB])
    pagina_vazia = MagicMock(data=[])
    db = make_db_mock(primeira_pagina, pagina_vazia)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/exportar")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    body = res.content.decode("utf-8-sig")
    linhas = body.strip().split("\r\n")
    assert len(linhas) == 2
    assert linhas[0].startswith("codigo;tipo_negocio;disponibilidade")
    assert "IMO-00001" in linhas[1]


def test_exportar_imoveis_exige_autenticacao(anon_client):
    res = anon_client.get("/imoveis/exportar")
    assert res.status_code == 403


# ── RBAC: corretor é read-only ───────────────────────────────────────────────

def test_corretor_pode_listar_imoveis(corretor_client):
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = corretor_client.get("/imoveis/")
    assert res.status_code == 200


def test_corretor_nao_pode_criar_imovel(corretor_client):
    res = corretor_client.post("/imoveis/", json=IMOVEL_PAYLOAD)
    assert res.status_code == 403


def test_corretor_nao_pode_deletar_imovel(corretor_client):
    res = corretor_client.delete("/imoveis/imovel-uuid-1")
    assert res.status_code == 403


# ── Destaques (carrossel da home) ─────────────────────────────────────────────

def test_destaques_publico_retorna_ordenados(anon_client):
    """Endpoint público de destaques é acessível sem auth e retorna em ordem."""
    destaque1 = {**IMOVEL_DB, "id": "i1", "codigo": "IMO-001", "destaque_ordem": 1}
    destaque3 = {**IMOVEL_DB, "id": "i3", "codigo": "IMO-003", "destaque_ordem": 3}
    db = make_db_mock(MagicMock(data=[destaque1, destaque3]))

    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/destaques")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["codigo"] == "IMO-001"
    assert body[1]["codigo"] == "IMO-003"


def test_destaques_publico_vazio(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/destaques")
    assert res.status_code == 200
    assert res.json() == []


def test_atualizar_imovel_libera_posicao_de_destaque_anterior(client):
    """Ao definir destaque_ordem=2 no imóvel A, o B que estava em 2 deve perder."""
    atualizado = {**IMOVEL_DB, "destaque_ordem": 2}
    update_libera = MagicMock(data=[])  # libera posição
    update_imovel = MagicMock(data=[atualizado])
    tag_del = MagicMock(data=[])
    detail = MagicMock(data=atualizado)
    db = make_db_mock(update_libera, update_imovel, tag_del, detail)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.put(
            "/imoveis/imovel-uuid-1",
            json={**IMOVEL_PAYLOAD, "destaque_ordem": 2},
        )

    assert res.status_code == 200
    # A 1ª chamada de .update() é o liberar (sets destaque_ordem=None)
    primeiro_update = db.update.call_args_list[0].args[0]
    assert primeiro_update == {"destaque_ordem": None}


def test_destaque_ordem_invalido_retorna_400(client):
    """Posição fora do range 1-5 é rejeitada."""
    db = make_db_mock(MagicMock(data=[IMOVEL_DB]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.put(
            "/imoveis/imovel-uuid-1",
            json={**IMOVEL_PAYLOAD, "destaque_ordem": 99},
        )
    assert res.status_code == 400
    assert "1 e 5" in res.json()["detail"]
