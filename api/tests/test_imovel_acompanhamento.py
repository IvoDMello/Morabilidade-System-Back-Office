"""Testes do acompanhamento do imóvel: visitas, percepções, import CSV e o job
de relatório de 30 dias (núcleo `_processar_relatorio` + varredura)."""
from unittest.mock import MagicMock, patch

import pytest

from tests.conftest import make_db_mock
from app.routers import imovel_acompanhamento as mod

ROUTER = "app.routers.imovel_acompanhamento.supabase_admin"


def _visita(**over):
    """VisitaOut completa (satisfaz o response_model do router)."""
    base = {
        "id": "v1", "imovel_id": "abc", "visitante_nome": "Ana",
        "visitante_telefone": None, "data_visita": "2026-06-01",
        "comentario": None, "created_at": "2026-06-01T00:00:00+00:00",
        "created_by": None,
    }
    base.update(over)
    return base


# ── Visitas ──────────────────────────────────────────────────────────────────

def test_listar_visitas_ok(client):
    db = make_db_mock(MagicMock(data=[_visita()]))
    with patch(ROUTER, db):
        resp = client.get("/imoveis/abc/visitas")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "v1"


def test_listar_visitas_vazio_retorna_lista(client):
    db = make_db_mock(MagicMock(data=None))
    with patch(ROUTER, db):
        resp = client.get("/imoveis/abc/visitas")
    assert resp.status_code == 200
    assert resp.json() == []


def test_criar_visita_ok(client):
    criada = {
        "id": "v1", "imovel_id": "abc", "visitante_nome": "Ana",
        "visitante_telefone": None, "data_visita": "2026-06-01",
        "comentario": None, "created_at": "2026-06-01T00:00:00+00:00",
        "created_by": None,
    }
    db = make_db_mock(MagicMock(data=[criada]))
    with patch(ROUTER, db):
        resp = client.post(
            "/imoveis/abc/visitas",
            json={"visitante_nome": "Ana", "data_visita": "2026-06-01"},
        )
    assert resp.status_code == 201
    assert resp.json()["visitante_nome"] == "Ana"


def test_criar_visita_sem_nome_422(client):
    db = make_db_mock()
    with patch(ROUTER, db):
        resp = client.post("/imoveis/abc/visitas", json={"data_visita": "2026-06-01"})
    assert resp.status_code == 422


def test_deletar_visita_admin_204(client):
    db = make_db_mock(MagicMock(data=[]))
    with patch(ROUTER, db):
        resp = client.delete("/imoveis/abc/visitas/v1")
    assert resp.status_code == 204


# ── Import CSV ───────────────────────────────────────────────────────────────

def _post_csv(client, conteudo: str):
    return client.post(
        "/imoveis/abc/visitas/import-csv",
        files={"arquivo": ("visitas.csv", conteudo.encode("utf-8"), "text/csv")},
    )


def test_import_csv_ok(client):
    csv_data = "visitante_nome,data_visita,comentario\nAna,2026-06-01,gostou\nBruno,02/06/2026,\n"
    db = make_db_mock(MagicMock(data=[_visita(id="v1"), _visita(id="v2", visitante_nome="Bruno")]))
    inserted = {}

    def capture_insert(payload):
        inserted["rows"] = payload
        return db
    db.insert.side_effect = capture_insert

    with patch(ROUTER, db):
        resp = _post_csv(client, csv_data)
    assert resp.status_code == 200
    assert len(inserted["rows"]) == 2
    assert inserted["rows"][0]["visitante_nome"] == "Ana"


def test_import_csv_detecta_ponto_e_virgula(client):
    csv_data = "visitante_nome;data_visita\nAna;2026-06-01\n"
    db = make_db_mock(MagicMock(data=[_visita(id="v1")]))
    captured = {}
    db.insert.side_effect = lambda p: (captured.update(rows=p) or db)
    with patch(ROUTER, db):
        resp = _post_csv(client, csv_data)
    assert resp.status_code == 200
    assert captured["rows"][0]["visitante_nome"] == "Ana"


def test_import_csv_sem_colunas_obrigatorias_400(client):
    csv_data = "foo,bar\n1,2\n"
    db = make_db_mock()
    with patch(ROUTER, db):
        resp = _post_csv(client, csv_data)
    assert resp.status_code == 400
    assert "visitante_nome" in resp.json()["detail"]


def test_import_csv_sem_linhas_validas_400(client):
    # cabeçalho ok, mas linha sem nome/data
    csv_data = "visitante_nome,data_visita\n,\n"
    db = make_db_mock()
    with patch(ROUTER, db):
        resp = _post_csv(client, csv_data)
    assert resp.status_code == 400
    assert "Nenhuma linha" in resp.json()["detail"]


def test_import_csv_pula_data_invalida(client):
    csv_data = "visitante_nome,data_visita\nAna,data-bugada\nBruno,2026-06-02\n"
    db = make_db_mock(MagicMock(data=[_visita(id="v2", visitante_nome="Bruno")]))
    captured = {}
    db.insert.side_effect = lambda p: (captured.update(rows=p) or db)
    with patch(ROUTER, db):
        resp = _post_csv(client, csv_data)
    assert resp.status_code == 200
    # só Bruno (data válida) entra
    assert len(captured["rows"]) == 1
    assert captured["rows"][0]["visitante_nome"] == "Bruno"


# ── _parse_data ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("entrada,esperado", [
    ("2026-06-01", "2026-06-01"),
    ("01/06/2026", "2026-06-01"),
    ("01-06-2026", "2026-06-01"),
])
def test_parse_data_formatos_validos(entrada, esperado):
    assert mod._parse_data(entrada).isoformat() == esperado


def test_parse_data_invalida_retorna_none():
    assert mod._parse_data("nao-e-data") is None


# ── Percepções ───────────────────────────────────────────────────────────────

def test_listar_percepcoes_ok(client):
    db = make_db_mock(MagicMock(data=[{"id": "p1", "imovel_id": "abc", "texto": "x",
                                       "created_at": "2026-06-01T00:00:00+00:00"}]))
    with patch(ROUTER, db):
        resp = client.get("/imoveis/abc/percepcoes")
    assert resp.status_code == 200
    assert resp.json()[0]["texto"] == "x"


def test_criar_percepcao_ok(client):
    criada = {"id": "p1", "imovel_id": "abc", "texto": "achou caro",
              "created_at": "2026-06-01T00:00:00+00:00", "created_by": None}
    db = make_db_mock(MagicMock(data=[criada]))
    with patch(ROUTER, db):
        resp = client.post("/imoveis/abc/percepcoes", json={"texto": "achou caro"})
    assert resp.status_code == 201
    assert resp.json()["texto"] == "achou caro"


def test_deletar_percepcao_204(client):
    db = make_db_mock(MagicMock(data=[]))
    with patch(ROUTER, db):
        resp = client.delete("/imoveis/abc/percepcoes/p1")
    assert resp.status_code == 204


# ── Job de 30 dias (token + varredura) ───────────────────────────────────────

def test_job_token_invalido_403(client):
    with patch.object(mod.settings, "cron_token", "segredo"):
        resp = client.post(
            "/imoveis/internal/jobs/relatorio-30dias",
            headers={"X-Cron-Token": "errado"},
        )
    assert resp.status_code == 403


def test_job_token_valido_chama_processamento(client):
    with patch.object(mod.settings, "cron_token", "segredo"), \
         patch.object(mod, "processar_relatorios_30dias", return_value={"candidatos": 0, "enviados": 0, "erros": []}) as proc:
        resp = client.post(
            "/imoveis/internal/jobs/relatorio-30dias",
            headers={"X-Cron-Token": "segredo"},
        )
    assert resp.status_code == 200
    proc.assert_called_once()


def test_processar_relatorios_30dias_sem_candidatos():
    db = make_db_mock(MagicMock(data=[]))
    with patch(ROUTER, db):
        res = mod.processar_relatorios_30dias()
    assert res == {"candidatos": 0, "enviados": 0, "erros": []}


def test_processar_relatorios_30dias_conta_enviados_e_erros():
    candidatos = MagicMock(data=[{"codigo": "A"}, {"codigo": "B"}])
    db = make_db_mock(candidatos)
    # primeiro imóvel ok, segundo levanta erro
    with patch(ROUTER, db), \
         patch.object(mod, "_processar_relatorio", side_effect=[None, RuntimeError("boom")]):
        res = mod.processar_relatorios_30dias()
    assert res["candidatos"] == 2
    assert res["enviados"] == 1
    assert len(res["erros"]) == 1
    assert res["erros"][0]["codigo"] == "B"


# ── _processar_relatorio (gera PDF + dispara e-mail + marca enviado) ──────────

def test_processar_relatorio_fluxo_completo():
    imovel = {
        "id": "abc", "codigo": "MOR-9", "logradouro": "Rua X", "numero": "10",
        "bairro": "Glória", "cidade": "Rio", "created_at": "2026-05-01T00:00:00+00:00",
        "proprietario_id": "prop-1",
    }
    prop = MagicMock(data={"nome_completo": "Dona Maria", "telefone": "2199"})
    fichas = MagicMock(data=[{"visitante_nome": "Ana", "assinada_em": "2026-05-10"}])
    percepcoes = MagicMock(data=[{"texto": "achou caro", "created_at": "2026-05-11"}])
    update_res = MagicMock(data=[])
    db = make_db_mock(prop, fichas, percepcoes, update_res)

    with patch(ROUTER, db), \
         patch.object(mod, "gerar_relatorio_30dias_pdf", return_value=b"%PDF") as pdf, \
         patch.object(mod, "enviar_relatorio_30dias") as enviar:
        mod._processar_relatorio(imovel)

    pdf.assert_called_once()
    enviar.assert_called_once()
    kwargs = enviar.call_args.kwargs
    assert kwargs["codigo_imovel"] == "MOR-9"
    assert kwargs["proprietario_nome"] == "Dona Maria"
    assert kwargs["visitas_comprovadas"] == 1
    assert "Rua X" in kwargs["endereco"]


def test_processar_relatorio_sem_proprietario_usa_fallback():
    imovel = {
        "id": "abc", "codigo": "MOR-9", "logradouro": None, "numero": None,
        "bairro": "Glória", "cidade": "Rio", "created_at": "2026-05-01T00:00:00+00:00",
        "proprietario_id": None,
    }
    fichas = MagicMock(data=[])
    percepcoes = MagicMock(data=[])
    db = make_db_mock(fichas, percepcoes, MagicMock(data=[]))

    with patch(ROUTER, db), \
         patch.object(mod, "gerar_relatorio_30dias_pdf", return_value=b"%PDF"), \
         patch.object(mod, "enviar_relatorio_30dias") as enviar:
        mod._processar_relatorio(imovel)

    kwargs = enviar.call_args.kwargs
    assert kwargs["proprietario_nome"] == "Proprietário(a)"
    assert kwargs["visitas_comprovadas"] == 0
