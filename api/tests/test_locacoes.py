"""Testes do módulo de Administração de Locações (router + schemas).

Cobre Fase 1: CRUD de contratos, pagamentos mensais e endpoint de análises.
A geração de PDF (Fase 3) e os anexos (Fase 4) serão testados em arquivos
separados quando implementados.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock


# ── Fixtures de dados ────────────────────────────────────────────────────────

CONTRATO_DB = {
    "id": "contrato-uuid-1",
    "imovel_id": "imovel-uuid-1",
    "proprietario_id": "prop-uuid-1",
    "locatario_id": "loc-uuid-1",
    "data_inicio": "2026-01-01",
    "data_fim": "2027-12-31",
    "dia_vencimento": 5,
    "aluguel_mensal": "8500.00",
    "condominio_mensal": "2916.25",
    "incluir_condominio_cobranca": True,
    "fundo_reserva": "145.81",
    "fundo_obra": "0",
    "incluir_fundo_obra_cobranca": False,
    "iptu_anual": "0",
    "incluir_iptu_cobranca": False,
    "seguro_incendio_anual": "0",
    "incluir_seguro_incendio_cobranca": False,
    "numero_iptu": None,
    "dados_cobranca_pix": "exemplo@email.com",
    "observacoes_demonstrativo": None,
    "status": "ativo",
    "motivo_rescisao": None,
    "data_rescisao": None,
    "created_at": "2026-01-01T00:00:00+00:00",
    "updated_at": "2026-01-01T00:00:00+00:00",
    # Joins que o _SELECT_FULL produz — serão achatados pelo router
    "imovel": {
        "id": "imovel-uuid-1",
        "codigo": "IMO-00042",
        "logradouro": "Rua Artur Araripe",
        "numero": "82",
        "complemento": None,
        "bairro": "Gávea",
    },
    "proprietario": {
        "id": "prop-uuid-1",
        "nome_completo": "Pedro Bassan Jr",
        "email": "pedro@email.com",
        "telefone": "21988887777",
    },
    "locatario": {
        "id": "loc-uuid-1",
        "nome_completo": "Maria Locatária",
        "email": "maria@email.com",
        "telefone": "21977776666",
    },
}


CONTRATO_PAYLOAD = {
    "imovel_id": "imovel-uuid-1",
    "proprietario_id": "prop-uuid-1",
    "locatario_id": "loc-uuid-1",
    "data_inicio": "2026-01-01",
    "data_fim": "2027-12-31",
    "dia_vencimento": 5,
    "aluguel_mensal": "8500.00",
    "condominio_mensal": "2916.25",
    "incluir_condominio_cobranca": True,
    "fundo_reserva": "145.81",
    "dados_cobranca_pix": "exemplo@email.com",
}


PAGAMENTO_DB = {
    "id": "pag-uuid-1",
    "contrato_id": "contrato-uuid-1",
    "mes_referencia": "2026-05-01",
    "valor_devido": "8354.19",
    "valor_pago": None,
    "data_vencimento": "2026-05-05",
    "data_pagamento": None,
    "status": "pendente",
    "observacoes": None,
    "created_at": "2026-05-01T00:00:00+00:00",
    "updated_at": "2026-05-01T00:00:00+00:00",
}


# ── GET /locacoes/ ───────────────────────────────────────────────────────────

def test_listar_contratos(client):
    # Item da lista usa um select reduzido (sem email/telefone das partes)
    item = {
        "id": CONTRATO_DB["id"],
        "status": CONTRATO_DB["status"],
        "data_inicio": CONTRATO_DB["data_inicio"],
        "data_fim": CONTRATO_DB["data_fim"],
        "dia_vencimento": CONTRATO_DB["dia_vencimento"],
        "aluguel_mensal": CONTRATO_DB["aluguel_mensal"],
        "created_at": CONTRATO_DB["created_at"],
        "imovel": CONTRATO_DB["imovel"],
        "proprietario": {"id": "prop-uuid-1", "nome_completo": "Pedro Bassan Jr"},
        "locatario": {"id": "loc-uuid-1", "nome_completo": "Maria Locatária"},
    }
    count_res = MagicMock(count=1, data=[])
    data_res = MagicMock(count=1, data=[item])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["imovel"]["codigo"] == "IMO-00042"
    assert body[0]["proprietario"]["nome"] == "Pedro Bassan Jr"
    assert res.headers["x-total-count"] == "1"


def test_listar_contratos_filtro_status(client):
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/?status=rescindido")

    assert res.status_code == 200
    assert res.json() == []
    # Confirma que o filtro foi aplicado no eq (status -> "rescindido")
    chamadas_eq = [c.args for c in db.eq.call_args_list]
    assert any(c == ("status", "rescindido") for c in chamadas_eq)


def test_listar_contratos_exige_autenticacao(anon_client):
    res = anon_client.get("/locacoes/")
    assert res.status_code == 403


# ── GET /locacoes/{id} ───────────────────────────────────────────────────────

def test_obter_contrato_existente(client):
    db = make_db_mock(MagicMock(data=CONTRATO_DB))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_DB['id']}")

    assert res.status_code == 200
    body = res.json()
    assert body["id"] == CONTRATO_DB["id"]
    # Achatamento: imovel vira ParteResumo com endereco concatenado
    assert body["imovel"]["endereco"] == "Rua Artur Araripe, 82, Gávea"
    assert body["proprietario"]["nome"] == "Pedro Bassan Jr"
    assert body["locatario"]["nome"] == "Maria Locatária"


def test_obter_contrato_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=None))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/nao-existe")

    assert res.status_code == 404


# ── POST /locacoes/ ──────────────────────────────────────────────────────────

def test_criar_contrato(client):
    # 4 executes: checagem de duplicidade (vazio) + insert + sync imovel.proprietario_id
    # + _buscar_contrato
    db = make_db_mock(
        MagicMock(data=[]),
        MagicMock(data=[CONTRATO_DB]),
        MagicMock(data=[{"id": CONTRATO_PAYLOAD["imovel_id"]}]),  # sync update
        MagicMock(data=CONTRATO_DB),
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post("/locacoes/", json=CONTRATO_PAYLOAD)

    assert res.status_code == 201
    body = res.json()
    assert body["id"] == CONTRATO_DB["id"]

    # Confirma que Decimal foi serializado como float no payload do banco
    inserted = db.insert.call_args.args[0]
    assert isinstance(inserted["aluguel_mensal"], float)
    assert inserted["aluguel_mensal"] == 8500.00
    assert inserted["data_inicio"] == "2026-01-01"


def test_criar_contrato_data_fim_anterior_ao_inicio(client):
    payload = {**CONTRATO_PAYLOAD, "data_fim": "2025-12-31"}
    res = client.post("/locacoes/", json=payload)
    assert res.status_code == 422
    # Validator do schema fala da vigência
    assert any("data_fim" in str(e).lower() or "posterior" in str(e).lower()
               for e in res.json()["detail"])


def test_criar_contrato_proprietario_igual_ao_locatario(client):
    payload = {**CONTRATO_PAYLOAD, "locatario_id": CONTRATO_PAYLOAD["proprietario_id"]}
    res = client.post("/locacoes/", json=payload)
    assert res.status_code == 422


def test_criar_contrato_dia_vencimento_invalido(client):
    res = client.post("/locacoes/", json={**CONTRATO_PAYLOAD, "dia_vencimento": 32})
    assert res.status_code == 422


def test_criar_contrato_aluguel_negativo(client):
    res = client.post("/locacoes/", json={**CONTRATO_PAYLOAD, "aluguel_mensal": "-100"})
    assert res.status_code == 422


def test_criar_contrato_exige_admin(corretor_client):
    res = corretor_client.post("/locacoes/", json=CONTRATO_PAYLOAD)
    assert res.status_code == 403


def test_criar_contrato_bloqueia_duplicidade_quando_imovel_ja_tem_ativo(client):
    db = make_db_mock(MagicMock(data=[{"id": "outro-contrato"}]))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post("/locacoes/", json=CONTRATO_PAYLOAD)
    assert res.status_code == 409
    assert "ativo" in res.json()["detail"].lower()


# ── PATCH /locacoes/{id} ─────────────────────────────────────────────────────

def test_atualizar_contrato(client):
    atualizado = {**CONTRATO_DB, "aluguel_mensal": "9000.00"}
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data=[atualizado]),
        MagicMock(data=atualizado),
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch(
            f"/locacoes/{CONTRATO_DB['id']}",
            json={"aluguel_mensal": "9000.00"},
        )

    assert res.status_code == 200
    updated = db.update.call_args.args[0]
    assert updated["aluguel_mensal"] == 9000.00


def test_atualizar_contrato_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=None), MagicMock(data=[]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch("/locacoes/nao-existe", json={"aluguel_mensal": "9000.00"})

    assert res.status_code == 404


def test_atualizar_contrato_corretor_proibido(corretor_client):
    res = corretor_client.patch(
        f"/locacoes/{CONTRATO_DB['id']}",
        json={"aluguel_mensal": "9000.00"},
    )
    assert res.status_code == 403


# ── POST /locacoes/{id}/rescindir ────────────────────────────────────────────

def test_rescindir_contrato(client):
    rescindido = {
        **CONTRATO_DB,
        "status": "rescindido",
        "motivo_rescisao": "Locatário desocupou",
        "data_rescisao": "2026-06-15",
    }
    db = make_db_mock(
        MagicMock(data=[rescindido]),
        MagicMock(data=rescindido),
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/rescindir",
            json={"motivo_rescisao": "Locatário desocupou", "data_rescisao": "2026-06-15"},
        )

    assert res.status_code == 200
    updated = db.update.call_args.args[0]
    assert updated["status"] == "rescindido"
    assert updated["motivo_rescisao"] == "Locatário desocupou"
    assert updated["data_rescisao"] == "2026-06-15"


def test_rescindir_contrato_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            "/locacoes/nao-existe/rescindir",
            json={"motivo_rescisao": "x", "data_rescisao": "2026-06-15"},
        )
    assert res.status_code == 404


# ── DELETE /locacoes/{id} ────────────────────────────────────────────────────

def test_deletar_contrato_e_soft_delete(client):
    """DELETE marca como 'encerrado' em vez de remover (preserva histórico)."""
    db = make_db_mock(MagicMock(data=[{"id": CONTRATO_DB["id"]}]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.delete(f"/locacoes/{CONTRATO_DB['id']}")

    assert res.status_code == 204
    # Update foi chamado com status='encerrado'
    updated = db.update.call_args.args[0]
    assert updated == {"status": "encerrado"}
    # E o delete real NUNCA foi chamado
    db.delete.assert_not_called()


# ── Pagamentos ───────────────────────────────────────────────────────────────

def test_listar_pagamentos(client):
    db = make_db_mock(MagicMock(data=[PAGAMENTO_DB]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_DB['id']}/pagamentos")

    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["mes_referencia"] == "2026-05-01"


def test_listar_pagamentos_filtra_por_ano(client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_DB['id']}/pagamentos?ano=2026")

    assert res.status_code == 200
    chamadas_gte = [c.args for c in db.gte.call_args_list]
    assert any(c == ("mes_referencia", "2026-01-01") for c in chamadas_gte)


def test_criar_pagamento(client):
    # 2 executes: _buscar_contrato + insert
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data=[PAGAMENTO_DB]),
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/pagamentos",
            json={
                "mes_referencia": "2026-05-01",
                "valor_devido": "8354.19",
                "data_vencimento": "2026-05-05",
                "status": "pendente",
            },
        )

    assert res.status_code == 201
    assert res.json()["mes_referencia"] == "2026-05-01"

    inserted = db.insert.call_args.args[0]
    assert inserted["contrato_id"] == CONTRATO_DB["id"]
    assert inserted["valor_devido"] == 8354.19


def test_criar_pagamento_contrato_inexistente(client):
    db = make_db_mock(MagicMock(data=None))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            "/locacoes/nao-existe/pagamentos",
            json={
                "mes_referencia": "2026-05-01",
                "valor_devido": "8354.19",
                "data_vencimento": "2026-05-05",
            },
        )
    assert res.status_code == 404


def test_criar_pagamento_duplicado_retorna_409(client):
    # _buscar_contrato OK, mas insert lança erro de unique
    contrato_ok = MagicMock(data=CONTRATO_DB)
    insert_fail = MagicMock()
    insert_fail.execute.side_effect = Exception("duplicate key value violates unique constraint")

    db = MagicMock()
    for m in ("table", "select", "eq", "order", "range", "single"):
        getattr(db, m).return_value = db
    db.execute.side_effect = [contrato_ok]

    # insert retorna um objeto separado que lança no execute
    insert_chain = MagicMock()
    insert_chain.execute.side_effect = Exception(
        "duplicate key value violates unique constraint"
    )
    db.insert.return_value = insert_chain

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/pagamentos",
            json={
                "mes_referencia": "2026-05-01",
                "valor_devido": "8354.19",
                "data_vencimento": "2026-05-05",
            },
        )

    assert res.status_code == 409


def test_marcar_pagamento_como_pago_preenche_data_automaticamente(client):
    """PATCH com status=pago e sem data_pagamento → backend usa hoje."""
    pago = {**PAGAMENTO_DB, "status": "pago", "data_pagamento": "2026-05-15"}
    db = make_db_mock(MagicMock(data=PAGAMENTO_DB), MagicMock(data=[pago]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch(
            f"/locacoes/pagamentos/{PAGAMENTO_DB['id']}",
            json={"status": "pago"},
        )

    assert res.status_code == 200
    updated = db.update.call_args.args[0]
    assert updated["status"] == "pago"
    # data_pagamento foi preenchida automaticamente (formato ISO)
    assert "data_pagamento" in updated
    assert len(updated["data_pagamento"]) == 10  # YYYY-MM-DD


def test_atualizar_pagamento_nao_encontrado(client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch(
            "/locacoes/pagamentos/nao-existe",
            json={"status": "atrasado"},
        )
    assert res.status_code == 404


def test_atualizar_pagamento_sem_campos_retorna_400(client):
    res = client.patch(f"/locacoes/pagamentos/{PAGAMENTO_DB['id']}", json={})
    assert res.status_code == 400


def test_deletar_pagamento(client):
    db = make_db_mock(MagicMock(data=[]))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.delete(f"/locacoes/pagamentos/{PAGAMENTO_DB['id']}")

    assert res.status_code == 204
    db.delete.assert_called_once()


# ── GET /locacoes/analises ───────────────────────────────────────────────────

def test_analises_carteira_vazia(client):
    """Sem contratos e sem pagamentos — KPIs zeram, gráficos vazios."""
    db = make_db_mock(
        MagicMock(data=[]),  # contratos
        MagicMock(data=[]),  # pagamentos
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/analises?ano=2026")

    assert res.status_code == 200
    body = res.json()
    assert body["kpis"]["contratos_ativos"] == 0
    assert body["kpis"]["em_encerramento"] == 0
    assert body["kpis"]["rescindidos_no_ano"] == 0
    assert body["kpis"]["inadimplencia_pct"] == 0.0
    assert body["kpis"]["valor_em_aberto"] == 0.0
    assert body["contratos_ativos_por_bairro"] == {}


def test_analises_com_pagamentos(client):
    contratos = [
        {
            "id": "c1",
            "status": "ativo",
            "data_inicio": "2026-01-01",
            "data_fim": "2027-12-31",
            "aluguel_mensal": "8500",
            "imovel": {"bairro": "Gávea"},
        },
        {
            "id": "c2",
            "status": "ativo",
            "data_inicio": "2026-01-01",
            "data_fim": "2026-06-15",  # dentro dos próximos 60 dias considerando hoje
            "aluguel_mensal": "5000",
            "imovel": {"bairro": "Leblon"},
        },
        {
            "id": "c3",
            "status": "rescindido",
            "data_inicio": "2026-01-01",
            "data_fim": "2026-04-30",
            "aluguel_mensal": "3000",
            "imovel": {"bairro": "Ipanema"},
        },
    ]
    pagamentos = [
        # Pago — entra em receita realizada
        {"mes_referencia": "2026-04-01", "valor_devido": "8354.19",
         "valor_pago": "8354.19", "status": "pago"},
        # Atrasado — vira inadimplência
        {"mes_referencia": "2026-05-01", "valor_devido": "8354.19",
         "valor_pago": None, "status": "atrasado"},
        # Parcial — soma na receita o que foi pago + abre o restante
        {"mes_referencia": "2026-05-01", "valor_devido": "5000.00",
         "valor_pago": "2000.00", "status": "parcial"},
        # Pendente — só entra em "em aberto"
        {"mes_referencia": "2026-06-01", "valor_devido": "8354.19",
         "valor_pago": None, "status": "pendente"},
    ]
    db = make_db_mock(MagicMock(data=contratos), MagicMock(data=pagamentos))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/analises?ano=2026")

    assert res.status_code == 200
    body = res.json()
    assert body["kpis"]["contratos_ativos"] == 2
    assert body["kpis"]["rescindidos_no_ano"] == 1
    # 1 atrasado em 4 pagamentos = 25%
    assert body["kpis"]["inadimplencia_pct"] == 25.0
    # Em aberto: 8354.19 (atrasado) + 3000.00 (parcial restante) + 8354.19 (pendente)
    assert body["kpis"]["valor_em_aberto"] == round(8354.19 + 3000.00 + 8354.19, 2)
    # Receita realizada em abril: 8354.19; em maio: 2000.00 (parcial)
    assert body["receita_realizada_por_mes"]["4"] == 8354.19
    assert body["receita_realizada_por_mes"]["5"] == 2000.00
    # Bairros: só contratos ativos
    bairros = body["contratos_ativos_por_bairro"]
    assert bairros.get("Gávea") == 1
    assert bairros.get("Leblon") == 1
    assert "Ipanema" not in bairros


def test_analises_exige_autenticacao(anon_client):
    res = anon_client.get("/locacoes/analises")
    assert res.status_code == 403
