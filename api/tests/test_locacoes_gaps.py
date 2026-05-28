"""Testes adicionais cobrindo gaps identificados na verificação do recurso
de Administração de Aluguéis (ver pendências reportadas no PR de cobertura).

Foco: permissões admin-only que não estavam cobertas, validações de
schema marginais e filtros combinados na listagem.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock
from tests.test_locacoes import CONTRATO_DB, CONTRATO_PAYLOAD


def test_listar_pagamentos_permitido_para_corretor(corretor_client):
    db = make_db_mock(MagicMock(data=[]), MagicMock(data=[]))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = corretor_client.get(f"/locacoes/{CONTRATO_DB['id']}/pagamentos")
    assert res.status_code == 200


# ── Validações de schema marginais ──────────────────────────────────────────

def test_criar_contrato_taxa_administracao_acima_de_100(client):
    res = client.post(
        "/locacoes/",
        json={**CONTRATO_PAYLOAD, "taxa_administracao_pct": "150"},
    )
    assert res.status_code == 422


def test_criar_contrato_taxa_administracao_negativa(client):
    res = client.post(
        "/locacoes/",
        json={**CONTRATO_PAYLOAD, "taxa_administracao_pct": "-1"},
    )
    assert res.status_code == 422


def test_criar_contrato_dia_vencimento_zero(client):
    res = client.post("/locacoes/", json={**CONTRATO_PAYLOAD, "dia_vencimento": 0})
    assert res.status_code == 422


def test_criar_pagamento_valor_negativo(client):
    res = client.post(
        f"/locacoes/{CONTRATO_DB['id']}/pagamentos",
        json={
            "mes_referencia": "2026-05-01",
            "valor_devido": "-100",
            "data_vencimento": "2026-05-05",
        },
    )
    assert res.status_code == 422


def test_criar_pagamento_status_invalido(client):
    res = client.post(
        f"/locacoes/{CONTRATO_DB['id']}/pagamentos",
        json={
            "mes_referencia": "2026-05-01",
            "valor_devido": "1000",
            "data_vencimento": "2026-05-05",
            "status": "inexistente",
        },
    )
    assert res.status_code == 422


def test_rescindir_sem_motivo_retorna_422(client):
    res = client.post(
        f"/locacoes/{CONTRATO_DB['id']}/rescindir",
        json={"data_rescisao": "2026-06-15"},
    )
    assert res.status_code == 422


# ── Filtros combinados na listagem ──────────────────────────────────────────

def test_listar_contratos_filtros_combinados(client):
    count_res = MagicMock(count=0, data=[])
    data_res = MagicMock(count=0, data=[])
    db = make_db_mock(count_res, data_res)

    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get(
            "/locacoes/?status=ativo"
            f"&imovel_id=imo-1&proprietario_id=prop-1&locatario_id=loc-1"
        )
    assert res.status_code == 200
    chamadas_eq = [c.args for c in db.eq.call_args_list]
    assert ("status", "ativo") in chamadas_eq
    assert ("imovel_id", "imo-1") in chamadas_eq
    assert ("proprietario_id", "prop-1") in chamadas_eq
    assert ("locatario_id", "loc-1") in chamadas_eq


def test_listar_contratos_paginacao_aplica_range(client):
    db = make_db_mock(
        MagicMock(count=50, data=[]),
        MagicMock(count=50, data=[]),
    )
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.get("/locacoes/?page=3&page_size=10")
    assert res.status_code == 200
    # offset = (3-1)*10 = 20; range = (20, 29)
    chamadas_range = [c.args for c in db.range.call_args_list]
    assert (20, 29) in chamadas_range
    assert res.headers["x-total-count"] == "50"


def test_listar_contratos_page_size_acima_do_limite(client):
    res = client.get("/locacoes/?page_size=500")
    assert res.status_code == 422


# ── PATCH contrato: campos não permitidos são ignorados silenciosamente ─────

def test_atualizar_contrato_data_fim_anterior_ao_inicio_no_patch(client):
    """Fix 1: ContratoLocacaoUpdate agora revalida vigência quando ambas as
    datas vêm no PATCH."""
    res = client.patch(
        f"/locacoes/{CONTRATO_DB['id']}",
        json={"data_inicio": "2026-06-01", "data_fim": "2026-05-01"},
    )
    assert res.status_code == 422


def test_atualizar_contrato_so_uma_data_no_patch_passa(client):
    """Se vier só uma das datas, não dá pra cruzar — segue para o banco."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data=[CONTRATO_DB]),
        MagicMock(data=CONTRATO_DB),
    )
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch(
            f"/locacoes/{CONTRATO_DB['id']}",
            json={"data_fim": "2028-12-31"},
        )
    assert res.status_code == 200


def test_atualizar_contrato_status_no_patch_e_ignorado(client):
    """Fix 7: PATCH não deve trocar status diretamente — use /rescindir."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data=[CONTRATO_DB]),
        MagicMock(data=CONTRATO_DB),
    )
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch(
            f"/locacoes/{CONTRATO_DB['id']}",
            json={"status": "rescindido", "aluguel_mensal": "9000"},
        )
    assert res.status_code == 200
    updated = db.update.call_args.args[0]
    assert "status" not in updated
    assert updated["aluguel_mensal"] == 9000.0


def test_encerrar_contrato_inexistente_retorna_404(client):
    """Fix 2: DELETE /locacoes/{id} retorna 404 em vez de no-op silencioso."""
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.delete("/locacoes/nao-existe")
    assert res.status_code == 404


def test_aplicar_reajuste_que_zera_aluguel_bloqueado(client):
    """Fix 3: reajuste de -100% (ou pior) deve retornar 422."""
    db = make_db_mock(MagicMock(data=CONTRATO_DB))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/reajustar",
            json={"data_aplicacao": "2027-01-01", "percentual": "-100"},
        )
    assert res.status_code == 422
    assert "aluguel" in res.json()["detail"].lower()


def test_aplicar_reajuste_extremamente_negativo_bloqueado(client):
    db = make_db_mock(MagicMock(data=CONTRATO_DB))
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_DB['id']}/reajustar",
            json={"data_aplicacao": "2027-01-01", "percentual": "-150"},
        )
    assert res.status_code == 422


def test_marcar_atrasados_loga_excecao_em_vez_de_silenciar(client, caplog):
    """Fix 4: exceção do banco em _marcar_atrasados é logada (não engolida)."""
    import logging
    db = MagicMock()
    for m in ("table", "select", "eq", "order", "range", "single", "update",
              "lt", "gte", "lte", "in_"):
        getattr(db, m).return_value = db
    # Primeiro execute (update atrasados) lança; depois retorna lista vazia
    db.execute.side_effect = [Exception("connection lost"), MagicMock(data=[])]

    with patch("app.routers.locacoes.supabase_admin", db), \
         caplog.at_level(logging.ERROR, logger="app.routers.locacoes"):
        res = client.get(f"/locacoes/{CONTRATO_DB['id']}/pagamentos")

    assert res.status_code == 200
    assert any("marcar pagamentos atrasados" in r.message.lower() for r in caplog.records)


def test_enviar_demonstrativo_com_para_explicito_busca_nome_no_banco(client):
    """Fix 5: mesmo com 'para' explícito, busca clientes para garantir
    nome_locatario consistente."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data={"email": "ignorado@ex.com", "nome_completo": "Maria Ref"}),
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
    assert mock_send.call_args.kwargs["nome_locatario"] == "Maria Ref"
    assert mock_send.call_args.kwargs["para"] == "outro@destino.com"


def test_atualizar_contrato_ignora_campos_imutaveis(client):
    """imovel_id/proprietario_id/locatario_id não existem no Update — pydantic
    ignora extras por padrão (model_config sem extra='forbid'). Garante que o
    PATCH não acidentalmente troca uma das partes do contrato."""
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),
        MagicMock(data=[CONTRATO_DB]),
        MagicMock(data=CONTRATO_DB),
    )
    with patch("app.routers.locacoes.supabase_admin", db):
        res = client.patch(
            f"/locacoes/{CONTRATO_DB['id']}",
            json={"imovel_id": "outro", "aluguel_mensal": "9000"},
        )
    assert res.status_code == 200
    updated = db.update.call_args.args[0]
    assert "imovel_id" not in updated
    assert updated["aluguel_mensal"] == 9000.0
