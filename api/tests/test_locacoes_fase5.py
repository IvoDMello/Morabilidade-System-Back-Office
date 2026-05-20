"""Testes das melhorias da Fase 5: envio de PDF por e-mail, reajuste
anual e relatório de repasse ao proprietário."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock
from tests.test_locacoes import CONTRATO_DB


# ── Envio do demonstrativo por e-mail ───────────────────────────────────────

def test_enviar_demonstrativo_usa_email_do_locatario_por_padrao(client):
    # Sequência: _buscar (1) + select email cliente (2) + select snapshot (3) + insert snapshot (4)
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),                                # _buscar
        MagicMock(data={"email": "loc@email.com",                   # busca email locatário
                        "nome_completo": "Maria Locatária"}),
        MagicMock(data=[]),                                          # select snapshot
        MagicMock(data=[{}]),                                        # insert snapshot
    )

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.routers.locacoes.enviar_demonstrativo_locacao") as mock_send:
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo/enviar?mes=2026-05"
        )

    assert res.status_code == 200
    assert res.json()["enviado_para"] == "loc@email.com"
    mock_send.assert_called_once()
    chamada = mock_send.call_args.kwargs
    assert chamada["para"] == "loc@email.com"
    assert chamada["mes_label"] == "Maio/2026"
    assert chamada["nome_arquivo"].endswith(".pdf")
    assert chamada["pdf_bytes"].startswith(b"%PDF-")


def test_enviar_demonstrativo_com_email_explicito(client):
    # Sequência: _buscar + clientes (sempre consultado, mesmo com 'para') +
    # select snapshot + insert snapshot.
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data={"email": "loc@email.com", "nome_completo": "Maria"}),
        MagicMock(data=[]),
        MagicMock(data=[{}]),
    )

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.routers.locacoes.enviar_demonstrativo_locacao") as mock_send:
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo/enviar"
            "?mes=2026-05&para=outro@destino.com"
        )

    assert res.status_code == 200
    assert res.json()["enviado_para"] == "outro@destino.com"
    mock_send.assert_called_once()


def test_enviar_demonstrativo_locatario_sem_email_retorna_422(client):
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data={"email": None, "nome_completo": "Maria"}),
    )

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.routers.locacoes.enviar_demonstrativo_locacao"):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo/enviar?mes=2026-05"
        )

    assert res.status_code == 422


def test_enviar_demonstrativo_falha_no_resend_retorna_502(client):
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data={"email": "loc@email.com", "nome_completo": "Maria"}),
        MagicMock(data=[]),
        MagicMock(data=[{}]),
    )

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.routers.locacoes.enviar_demonstrativo_locacao",
               side_effect=Exception("Resend offline")):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/demonstrativo/enviar?mes=2026-05"
        )

    assert res.status_code == 502


def test_enviar_demonstrativo_exige_admin(corretor_client):
    res = corretor_client.post(
        f"/locacoes/{CONTRATO_DB['id']}/demonstrativo/enviar?mes=2026-05"
    )
    assert res.status_code == 403


# ── Auto-marcação de atrasados ──────────────────────────────────────────────

def test_listar_pagamentos_dispara_marcacao_de_atrasados(client):
    """O update de atrasados é o 1º execute; depois vem o select."""
    db = make_db_mock(
        MagicMock(data=[]),  # update atrasados
        MagicMock(data=[]),  # select pagamentos
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_DB['id']}/pagamentos")

    assert res.status_code == 200
    # Update foi chamado com {"status": "atrasado"}
    db.update.assert_called_with({"status": "atrasado"})


# ── Reajustes ───────────────────────────────────────────────────────────────

def test_aplicar_reajuste_cria_historico_e_atualiza_aluguel(client):
    """Reajuste de +4.25% sobre 8500 → 8861.25 (snapshot)."""
    reajuste_db = {
        "id": "reaj-1",
        "contrato_id": CONTRATO_DB["id"],
        "data_aplicacao": "2027-01-01",
        "percentual": "4.250",
        "aluguel_anterior": "8500.00",
        "aluguel_novo": "8861.25",
        "indice_referencia": "IGPM",
        "observacoes": None,
        "applied_by": "00000000-0000-0000-0000-000000000001",
        "created_at": "2026-12-30T00:00:00+00:00",
    }
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),    # _buscar_contrato
        MagicMock(data=[reajuste_db]),   # insert reajuste
        MagicMock(data=[{}]),            # update aluguel_mensal
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/reajustar",
            json={
                "data_aplicacao": "2027-01-01",
                "percentual": "4.25",
                "indice_referencia": "IGPM",
            },
        )

    assert res.status_code == 201
    inserted = db.insert.call_args.args[0]
    assert inserted["aluguel_anterior"] == 8500.0
    assert inserted["aluguel_novo"] == 8861.25
    # Update do contrato chamado com novo valor
    last_update = db.update.call_args.args[0]
    assert last_update["aluguel_mensal"] == 8861.25


def test_aplicar_reajuste_negativo_aceito(client):
    """Permite descontos (percentual negativo) — negociação com proprietário."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data=[{"id": "r", "contrato_id": "c", "data_aplicacao": "2027-01-01",
                         "percentual": "-5.000", "aluguel_anterior": "8500.00",
                         "aluguel_novo": "8075.00",
                         "indice_referencia": None, "observacoes": None,
                         "applied_by": None,
                         "created_at": "2026-12-30T00:00:00+00:00"}]),
        MagicMock(data=[{}]),
    )

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/reajustar",
            json={"data_aplicacao": "2027-01-01", "percentual": "-5"},
        )

    assert res.status_code == 201
    inserted = db.insert.call_args.args[0]
    assert inserted["aluguel_novo"] == 8075.0


def test_aplicar_reajuste_exige_admin(corretor_client):
    res = corretor_client.post(
        f"/locacoes/{CONTRATO_DB['id']}/reajustar",
        json={"data_aplicacao": "2027-01-01", "percentual": "4.25"},
    )
    assert res.status_code == 403


def test_listar_reajustes(client):
    reajustes = [
        {"id": "r1", "contrato_id": CONTRATO_DB["id"],
         "data_aplicacao": "2027-01-01", "percentual": "4.250",
         "aluguel_anterior": "8500.00", "aluguel_novo": "8861.25",
         "indice_referencia": "IGPM", "observacoes": None,
         "applied_by": None,
         "created_at": "2026-12-30T00:00:00+00:00"},
    ]
    db = make_db_mock(MagicMock(data=reajustes))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_DB['id']}/reajustes")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["aluguel_novo"] == "8861.25"


# ── Repasse ─────────────────────────────────────────────────────────────────

def test_repasses_vazio_para_mes_sem_pagamentos(client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/repasses?mes=2026-05")
    assert res.status_code == 200
    body = res.json()
    assert body["proprietarios"] == []
    assert body["total_recebido"] == "0"


def test_repasses_agrupa_por_proprietario(client):
    """2 pagamentos → 2 contratos → mesmo proprietário → 1 bloco."""
    pagamentos = [
        {"id": "p1", "contrato_id": "c1", "valor_devido": "5000",
         "valor_pago": "5000", "status": "pago"},
        {"id": "p2", "contrato_id": "c2", "valor_devido": "3000",
         "valor_pago": "3000", "status": "pago"},
    ]
    contratos = [
        {"id": "c1", "taxa_administracao_pct": "10.00",
         "proprietario_id": "prop-1",
         "imovel": {"codigo": "MB-001", "endereco": "Rua A", "bairro": "Gávea"},
         "proprietario": {"id": "prop-1", "nome_completo": "Maria",
                          "email": "m@a.com"}},
        {"id": "c2", "taxa_administracao_pct": "10.00",
         "proprietario_id": "prop-1",
         "imovel": {"codigo": "MB-002", "endereco": "Rua B", "bairro": "Leblon"},
         "proprietario": {"id": "prop-1", "nome_completo": "Maria",
                          "email": "m@a.com"}},
    ]
    db = make_db_mock(
        MagicMock(data=pagamentos),
        MagicMock(data=contratos),
    )
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/repasses?mes=2026-05")

    assert res.status_code == 200
    body = res.json()
    assert len(body["proprietarios"]) == 1
    prop = body["proprietarios"][0]
    assert prop["nome"] == "Maria"
    assert prop["total_recebido"] == "8000.00"
    assert prop["total_taxa"] == "800.00"      # 10% de 8000
    assert prop["total_repasse"] == "7200.00"
    assert len(prop["itens"]) == 2


def test_repasses_calcula_pagamento_parcial(client):
    pagamentos = [
        {"id": "p1", "contrato_id": "c1", "valor_devido": "5000",
         "valor_pago": "2000", "status": "parcial"},
    ]
    contratos = [
        {"id": "c1", "taxa_administracao_pct": "8.00",
         "proprietario_id": "p1",
         "imovel": {"codigo": "MB-001", "endereco": None, "bairro": None},
         "proprietario": {"id": "p1", "nome_completo": "João", "email": None}},
    ]
    db = make_db_mock(MagicMock(data=pagamentos), MagicMock(data=contratos))

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/repasses?mes=2026-05")

    body = res.json()
    item = body["proprietarios"][0]["itens"][0]
    assert item["valor_pago"] == "2000"
    assert item["valor_taxa"] == "160.00"    # 8% de 2000
    assert item["valor_repasse"] == "1840.00"


def test_repasses_mes_invalido(client):
    res = client.get("/locacoes/repasses?mes=invalido")
    assert res.status_code == 422


def test_repasses_exige_autenticacao(anon_client):
    res = anon_client.get("/locacoes/repasses?mes=2026-05")
    assert res.status_code == 403
