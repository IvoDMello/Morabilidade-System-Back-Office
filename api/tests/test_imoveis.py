"""Testes dos endpoints de imóveis."""
from unittest.mock import AsyncMock, MagicMock, patch

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
    "instagram_url": None,
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


# ── Busca livre (q), cobre código, logradouro e bairro ──────────────────────

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
    # 4 execute(): select codigo (single) + select contratos_locacao (count=0)
    # + select fotos (data=[]) + delete imovel
    codigo_mock = MagicMock(data={"codigo": "MB-00001"})
    contratos_mock = MagicMock(count=0, data=[])
    fotos_mock = MagicMock(data=[])
    delete_mock = MagicMock(data=[])
    db = make_db_mock(codigo_mock, contratos_mock, fotos_mock, delete_mock)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.delete("/imoveis/imovel-uuid-1")

    assert res.status_code == 204


def test_deletar_imovel_com_contrato_vinculado(client):
    codigo_mock = MagicMock(data={"codigo": "MB-00001"})
    contratos_mock = MagicMock(count=1, data=[{"id": "contrato-uuid-1"}])
    db = make_db_mock(codigo_mock, contratos_mock)

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


def test_atualizar_imovel_empurra_destaque_para_direita(client):
    """Ao definir destaque_ordem=2 no imóvel A, o B que estava em 2 vai para 3."""
    atualizado = {**IMOVEL_DB, "destaque_ordem": 2}
    ocupadas = MagicMock(data=[{"id": "i-b", "destaque_ordem": 2}])  # select do helper
    update_shift = MagicMock(data=[])  # B: 2 → 3
    update_imovel = MagicMock(data=[atualizado])
    tag_del = MagicMock(data=[])
    detail = MagicMock(data=atualizado)
    db = make_db_mock(ocupadas, update_shift, update_imovel, tag_del, detail)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.put(
            "/imoveis/imovel-uuid-1",
            json={**IMOVEL_PAYLOAD, "destaque_ordem": 2},
        )

    assert res.status_code == 200
    # A 1ª chamada de .update() é o shift: ocupante da posição 2 vai para a 3
    primeiro_update = db.update.call_args_list[0].args[0]
    assert primeiro_update == {"destaque_ordem": 3}


def test_atualizar_imovel_destaque_posicao_10_sai(client):
    """Quem ocupa a posição 10 sai do destaque quando é empurrado."""
    atualizado = {**IMOVEL_DB, "destaque_ordem": 10}
    ocupadas = MagicMock(data=[{"id": "i-b", "destaque_ordem": 10}])
    update_shift = MagicMock(data=[])  # B: 10 → None
    update_imovel = MagicMock(data=[atualizado])
    tag_del = MagicMock(data=[])
    detail = MagicMock(data=atualizado)
    db = make_db_mock(ocupadas, update_shift, update_imovel, tag_del, detail)

    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.put(
            "/imoveis/imovel-uuid-1",
            json={**IMOVEL_PAYLOAD, "destaque_ordem": 10},
        )

    assert res.status_code == 200
    primeiro_update = db.update.call_args_list[0].args[0]
    assert primeiro_update == {"destaque_ordem": None}


def test_destaque_ordem_invalido_retorna_400(client):
    """Posição fora do range 1-10 é rejeitada."""
    db = make_db_mock(MagicMock(data=[IMOVEL_DB]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.put(
            "/imoveis/imovel-uuid-1",
            json={**IMOVEL_PAYLOAD, "destaque_ordem": 99},
        )
    assert res.status_code == 400
    assert "1 e 10" in res.json()["detail"]


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


# ── GET /imoveis/publico/disponiveis, parâmetro ordenar ─────────────────────

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


# ── PII do proprietário NÃO pode vazar nos endpoints públicos (LGPD) ──────────

# Snapshot do join de proprietário tal como o PostgREST devolve.
_PROPRIETARIO_JOIN = {
    "id": "cli-1",
    "nome_completo": "Fulano de Tal",
    "telefone": "11999998888",
    "email": "fulano@example.com",
}


def test_disponiveis_publico_nao_vaza_proprietario(anon_client):
    """O objeto proprietario (nome/telefone/e-mail) é PII de terceiro e não
    pode aparecer na resposta pública consumida pelo site."""
    imovel = {**IMOVEL_DB, "proprietario_id": "cli-1", "proprietario": _PROPRIETARIO_JOIN}
    count_mock = MagicMock(count=1, data=[])
    data_mock = MagicMock(count=1, data=[imovel])
    db = make_db_mock(count_mock, data_mock)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/disponiveis")
    assert res.status_code == 200
    item = res.json()[0]
    assert item.get("proprietario") is None
    assert item.get("proprietario_id") is None
    assert "fulano@example.com" not in res.text


def test_destaques_publico_nao_vaza_proprietario(anon_client):
    imovel = {**IMOVEL_DB, "destaque_ordem": 1,
              "proprietario_id": "cli-1", "proprietario": _PROPRIETARIO_JOIN}
    db = make_db_mock(MagicMock(data=[imovel]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/destaques")
    assert res.status_code == 200
    item = res.json()[0]
    assert item.get("proprietario") is None
    assert item.get("proprietario_id") is None
    assert "fulano@example.com" not in res.text


def test_detalhe_publico_nao_vaza_proprietario_nem_internas(anon_client):
    """O detalhe público oculta dados internos e o proprietário."""
    imovel = {
        **IMOVEL_DB,
        "proprietario_id": "cli-1",
        "proprietario": _PROPRIETARIO_JOIN,
        "observacoes_internas": "segredo",
        "numero_matricula": "12345",
    }
    id_lookup = MagicMock(data={"id": "imovel-uuid-1"})
    detail = MagicMock(data=imovel)
    db = make_db_mock(id_lookup, detail)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = anon_client.get("/imoveis/publico/MB-00001")
    assert res.status_code == 200
    body = res.json()
    assert body.get("proprietario") is None
    assert body.get("observacoes_internas") is None
    assert body.get("numero_matricula") is None
    assert "fulano@example.com" not in res.text
    assert "segredo" not in res.text


# ── Gestão de fotos (upload / remoção / reordenação / rotação) ────────────────

def test_upload_fotos_sucesso(client):
    count = MagicMock(count=0, data=[])
    inserted = MagicMock(data=[{"id": "f1", "url": "https://u/1.jpg", "ordem": 1}])
    db = make_db_mock(count, inserted)
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.upload_foto", new=AsyncMock(return_value="https://u/1.jpg")):
        res = client.post(
            "/imoveis/imovel-uuid-1/fotos",
            files=[("fotos", ("a.jpg", b"\xff\xd8\xff", "image/jpeg"))],
        )
    assert res.status_code == 201
    assert res.json()[0]["url"] == "https://u/1.jpg"


def test_upload_fotos_excede_limite_de_30(client):
    count = MagicMock(count=30, data=[])
    db = make_db_mock(count)
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.upload_foto", new=AsyncMock(return_value="x")):
        res = client.post(
            "/imoveis/imovel-uuid-1/fotos",
            files=[("fotos", ("a.jpg", b"\xff\xd8\xff", "image/jpeg"))],
        )
    assert res.status_code == 400
    assert "30 fotos" in res.json()["detail"]


def test_remover_foto_sucesso(client):
    foto = MagicMock(data={"id": "f1", "url": "https://x/object/public/media/imoveis/1/a.jpg"})
    delete_res = MagicMock(data=[])
    db = make_db_mock(foto, delete_res)
    deletar = AsyncMock()
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.deletar_foto", new=deletar):
        res = client.delete("/imoveis/imovel-uuid-1/fotos/f1")
    assert res.status_code == 204
    deletar.assert_awaited_once()


def test_remover_foto_nao_encontrada(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.deletar_foto", new=AsyncMock()):
        res = client.delete("/imoveis/imovel-uuid-1/fotos/inexistente")
    assert res.status_code == 404


def test_reordenar_fotos_sucesso(client):
    existentes = MagicMock(data=[{"id": "a"}, {"id": "b"}])
    db = make_db_mock(existentes, MagicMock(data=[]), MagicMock(data=[]))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.patch(
            "/imoveis/imovel-uuid-1/fotos/ordem",
            json={"foto_ids": ["b", "a"]},
        )
    assert res.status_code == 200
    assert res.json() == {"atualizadas": 2}


def test_reordenar_fotos_lista_vazia(client):
    db = make_db_mock()
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.patch("/imoveis/imovel-uuid-1/fotos/ordem", json={"foto_ids": []})
    assert res.status_code == 400


def test_reordenar_fotos_ids_duplicados(client):
    db = make_db_mock()
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.patch(
            "/imoveis/imovel-uuid-1/fotos/ordem", json={"foto_ids": ["a", "a"]}
        )
    assert res.status_code == 400
    assert "duplicados" in res.json()["detail"].lower()


def test_reordenar_fotos_divergente_do_banco(client):
    existentes = MagicMock(data=[{"id": "a"}, {"id": "b"}])
    db = make_db_mock(existentes)
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.patch(
            "/imoveis/imovel-uuid-1/fotos/ordem", json={"foto_ids": ["a", "c"]}
        )
    assert res.status_code == 400
    assert "não corresponde" in res.json()["detail"]


def test_rotacionar_foto_sucesso(client):
    foto = MagicMock(data={"id": "f1", "url": "https://old/a.jpg", "ordem": 2})
    db = make_db_mock(foto, MagicMock(data=[]))
    with patch("app.routers.imoveis.supabase_admin", db), \
         patch("app.routers.imoveis.baixar_e_rotacionar", return_value=b"jpeg"), \
         patch("app.routers.imoveis.upload_bytes_jpeg", return_value="https://new/a.jpg"), \
         patch("app.routers.imoveis.deletar_foto", new=AsyncMock()) as deletar:
        res = client.post(
            "/imoveis/imovel-uuid-1/fotos/f1/rotacionar", json={"graus": 90}
        )
    assert res.status_code == 200
    body = res.json()
    assert body["url"] == "https://new/a.jpg"
    assert body["ordem"] == 2
    # Apaga o arquivo antigo após trocar o registro.
    deletar.assert_awaited_with("https://old/a.jpg")


def test_rotacionar_foto_nao_encontrada(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.imoveis.supabase_admin", db):
        res = client.post(
            "/imoveis/imovel-uuid-1/fotos/inexistente/rotacionar", json={"graus": 90}
        )
    assert res.status_code == 404
