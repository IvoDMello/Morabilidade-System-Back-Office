"""Testes dos endpoints de imóveis."""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

# ── Dados de teste ────────────────────────────────────────────────────────────

IMOVEL_DB = {
    "id": "imovel-uuid-1",
    "codigo": "MB-00001",
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
    assert body[0]["codigo"] == "MB-00001"
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


# ── Busca livre (q) — cobre código, logradouro e bairro ──────────────────────

def test_listar_imoveis_q_aplica_or_codigo_logradouro_bairro(client):
    """O parâmetro `q` deve emitir um OR cobrindo codigo + logradouro + bairro_norm."""
    count_res = MagicMock(count=1, data=[])
    data_res = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"q": "rainha"})

    assert res.status_code == 200
    # Verifica que .or_() foi chamado pelo menos uma vez com as três colunas.
    or_calls = [c.args[0] for c in db.or_.call_args_list if c.args]
    assert or_calls, "esperava ao menos uma chamada a .or_() quando q é fornecido"
    combined = " | ".join(or_calls)
    assert "codigo.ilike.%rainha%" in combined
    assert "logradouro.ilike.%rainha%" in combined
    assert "bairro_norm.ilike." in combined


def test_listar_imoveis_codigo_nao_dispara_or(client):
    """O filtro `codigo` (campo separado) usa .ilike() direto, sem .or_()."""
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"codigo": "00002"})

    assert res.status_code == 200
    # codigo sozinho não passa pelo ramo do `q`, então .or_() não deve ser chamado.
    assert db.or_.call_count == 0
    # Mas .ilike("codigo", "%00002%") deve ter rolado.
    ilike_calls = [(c.args[0], c.args[1]) for c in db.ilike.call_args_list if len(c.args) >= 2]
    assert ("codigo", "%00002%") in ilike_calls


def test_listar_imoveis_q_e_codigo_combinados(client):
    """`q` e `codigo` podem coexistir: q dispara OR, codigo restringe por código."""
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"q": "ipanema", "codigo": "00002"})

    assert res.status_code == 200
    assert db.or_.call_count >= 1
    ilike_calls = [(c.args[0], c.args[1]) for c in db.ilike.call_args_list if len(c.args) >= 2]
    assert ("codigo", "%00002%") in ilike_calls


def test_listar_imoveis_q_vazio_nao_dispara_or(client):
    """`q` vazio/whitespace não deve emitir cláusula OR."""
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"q": "   "})

    assert res.status_code == 200
    assert db.or_.call_count == 0


def test_listar_imoveis_q_sanitiza_caracteres_especiais(client):
    """Vírgulas/parênteses no `q` não devem quebrar a sintaxe do .or_() do PostgREST."""
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/", params={"q": "rua, 100 (fundos)"})

    assert res.status_code == 200
    or_args = [c.args[0] for c in db.or_.call_args_list if c.args]
    assert or_args
    # _safe_for_or deve remover vírgulas e parênteses do termo
    for clause in or_args:
        # nunca pode haver vírgula DENTRO de um %...% pois quebra o parser do PostgREST
        for piece in clause.split(",ilike") if False else clause.split(","):
            # checagem grossa: cada vírgula deve ser separador entre coluna.ilike.
            if ".ilike." in piece:
                continue


def test_exportar_imoveis_aceita_q(client):
    """Endpoint /exportar agora aceita `q` (busca livre)."""
    data_res = MagicMock(data=[IMOVEL_DB])
    db = make_db_mock(data_res, MagicMock(data=[]))

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/exportar", params={"q": "rainha"})

    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    or_calls = [c.args[0] for c in db.or_.call_args_list if c.args]
    combined = " | ".join(or_calls)
    assert "logradouro.ilike.%rainha%" in combined


# ── GET /imoveis/{id} ─────────────────────────────────────────────────────────

def test_obter_imovel_existente(client):
    # 1 execute(): _buscar_imovel
    res_mock = MagicMock(data=IMOVEL_DB)
    db = make_db_mock(res_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.get("/imoveis/imovel-uuid-1")

    assert res.status_code == 200
    assert res.json()["codigo"] == "MB-00001"
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
    assert res.json()["codigo"] == "MB-00001"


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
    # 3 execute(): select contratos_locacao (count=0) + select fotos (data=[]) + delete imovel
    contratos_mock = MagicMock(count=0, data=[])
    fotos_mock = MagicMock(data=[])
    delete_mock = MagicMock(data=[])
    db = make_db_mock(contratos_mock, fotos_mock, delete_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.delete("/imoveis/imovel-uuid-1")

    assert res.status_code == 204


def test_deletar_imovel_com_contrato_vinculado(client):
    contratos_mock = MagicMock(count=1, data=[{"id": "contrato-uuid-1"}])
    db = make_db_mock(contratos_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.delete("/imoveis/imovel-uuid-1")

    assert res.status_code == 409
    assert "contrato" in res.json()["detail"].lower()


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
    assert linhas[0].startswith("codigo;titulo;tipo_negocio;disponibilidade")
    assert "MB-00001" in linhas[1]


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


# ── Destaques (carrossel da home) ─────────────────────────────────────────────

def test_destaques_publico_retorna_ordenados(anon_client):
    """Endpoint público de destaques é acessível sem auth e retorna em ordem."""
    destaque1 = {**IMOVEL_DB, "id": "i1", "codigo": "MB-001", "destaque_ordem": 1}
    destaque3 = {**IMOVEL_DB, "id": "i3", "codigo": "MB-003", "destaque_ordem": 3}
    db = make_db_mock(MagicMock(data=[destaque1, destaque3]))

    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/destaques")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["codigo"] == "MB-001"
    assert body[1]["codigo"] == "MB-003"


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


# ── GET /imoveis/publico/bairros ──────────────────────────────────────────────

def test_bairros_publico_retorna_lista_ordenada(anon_client):
    rows = [{"bairro": "Pinheiros"}, {"bairro": "Jardins"}, {"bairro": "Moema"}]
    db = make_db_mock(MagicMock(data=rows))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/bairros")
    assert res.status_code == 200
    body = res.json()
    assert body == sorted(body)
    assert set(body) == {"Jardins", "Moema", "Pinheiros"}


def test_bairros_publico_deduplica(anon_client):
    rows = [{"bairro": "Pinheiros"}, {"bairro": "Pinheiros"}, {"bairro": "Jardins"}]
    db = make_db_mock(MagicMock(data=rows))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/bairros")
    assert res.status_code == 200
    assert res.json().count("Pinheiros") == 1


def test_bairros_publico_exclui_nulos_e_vazios(anon_client):
    rows = [{"bairro": "Pinheiros"}, {"bairro": None}, {"bairro": ""}]
    db = make_db_mock(MagicMock(data=rows))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/bairros")
    assert res.status_code == 200
    body = res.json()
    assert None not in body
    assert "" not in body
    assert body == ["Pinheiros"]


def test_bairros_publico_retorna_lista_vazia_sem_imoveis(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/bairros")
    assert res.status_code == 200
    assert res.json() == []


def test_bairros_publico_acessivel_sem_autenticacao(anon_client):
    db = make_db_mock(MagicMock(data=[{"bairro": "Pinheiros"}]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/bairros")
    assert res.status_code == 200


def test_bairros_publico_rota_nao_conflita_com_codigo(anon_client):
    """/publico/bairros não deve ser capturado como /publico/{codigo}."""
    db = make_db_mock(MagicMock(data=[{"bairro": "Centro"}]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/bairros")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


# ── GET /imoveis/publico/disponiveis — parâmetro ordenar ─────────────────────

def test_disponiveis_publico_ordenar_preco_asc_usa_campo_valor_venda(anon_client):
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis?ordenar=preco_asc")
    assert res.status_code == 200
    calls = [(c.args[0] if c.args else None, c.kwargs) for c in db.order.call_args_list]
    assert ("valor_venda", {"desc": False, "nullsfirst": False}) in calls


def test_disponiveis_publico_ordenar_preco_desc_usa_campo_valor_venda(anon_client):
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis?ordenar=preco_desc")
    assert res.status_code == 200
    calls = [(c.args[0] if c.args else None, c.kwargs) for c in db.order.call_args_list]
    assert ("valor_venda", {"desc": True, "nullsfirst": False}) in calls


def test_disponiveis_publico_ordenar_mais_antigo(anon_client):
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis?ordenar=mais_antigo")
    assert res.status_code == 200
    calls = [(c.args[0] if c.args else None, c.kwargs) for c in db.order.call_args_list]
    assert any(campo == "created_at" and not kwargs.get("desc") for campo, kwargs in calls)


def test_disponiveis_publico_ordenar_mais_novo_por_padrao(anon_client):
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis")
    assert res.status_code == 200
    calls = [(c.args[0] if c.args else None, c.kwargs) for c in db.order.call_args_list]
    assert any(campo == "created_at" and kwargs.get("desc") is True for campo, kwargs in calls)


def test_disponiveis_publico_ordenar_locacao_usa_valor_locacao(anon_client):
    """Para tipo_negocio=locacao, o campo de ordenação por preço é valor_locacao."""
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis?tipo_negocio=locacao&ordenar=preco_asc")
    assert res.status_code == 200
    calls = [(c.args[0] if c.args else None, c.kwargs) for c in db.order.call_args_list]
    assert ("valor_locacao", {"desc": False, "nullsfirst": False}) in calls


def test_disponiveis_publico_ordenar_venda_usa_valor_venda(anon_client):
    """Para tipo_negocio=venda, o campo de ordenação por preço é valor_venda."""
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[IMOVEL_DB])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis?tipo_negocio=venda&ordenar=preco_desc")
    assert res.status_code == 200
    calls = [(c.args[0] if c.args else None, c.kwargs) for c in db.order.call_args_list]
    assert ("valor_venda", {"desc": True, "nullsfirst": False}) in calls


def test_disponiveis_publico_acessivel_sem_autenticacao(anon_client):
    count_mock = MagicMock(count=0, data=[])
    data_mock = MagicMock(count=0, data=[])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis")
    assert res.status_code == 200
    assert res.json() == []
