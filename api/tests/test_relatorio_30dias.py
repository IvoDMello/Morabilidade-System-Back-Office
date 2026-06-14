"""Testes do envio manual do relatório de 30 dias (endpoint sob demanda).

O núcleo (`_processar_relatorio`, que gera PDF e dispara o e-mail) é exercitado
pelos testes do PDF/e-mail; aqui o foco é o contrato do endpoint: exige imóvel
existente, chama o processamento e devolve o `relatorio_30dias_enviado_em`.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

ENDPOINT = "/imoveis/abc/relatorio-30dias/enviar"
PREVIEW = "/imoveis/abc/relatorio-30dias/preview"


def test_enviar_relatorio_manual_imovel_inexistente(client):
    db = make_db_mock(MagicMock(data=None))  # imóvel não encontrado
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db):
        resp = client.post(ENDPOINT)
    assert resp.status_code == 404


def test_enviar_relatorio_manual_ok(client):
    imovel = MagicMock(data={"id": "abc", "codigo": "MOR-1", "created_at": "2026-05-01T00:00:00+00:00"})
    enviado = MagicMock(data={"relatorio_30dias_enviado_em": "2026-06-13T12:00:00+00:00"})
    db = make_db_mock(imovel, enviado)
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db), \
         patch("app.routers.imovel_acompanhamento._processar_relatorio") as proc:
        resp = client.post(ENDPOINT)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "enviado"
    assert body["relatorio_30dias_enviado_em"] == "2026-06-13T12:00:00+00:00"
    proc.assert_called_once()


def test_enviar_relatorio_manual_erro_envio(client):
    """Falha no envio (ex.: Resend) vira 502 com detalhe, não 500 mudo."""
    imovel = MagicMock(data={"id": "abc", "codigo": "MOR-1", "created_at": "2026-05-01T00:00:00+00:00"})
    db = make_db_mock(imovel)
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db), \
         patch("app.routers.imovel_acompanhamento._processar_relatorio",
               side_effect=RuntimeError("Resend offline")):
        resp = client.post(ENDPOINT)
    assert resp.status_code == 502
    assert "Resend offline" in resp.json()["detail"]


def test_preview_relatorio_inexistente(client):
    db = make_db_mock(MagicMock(data=None))  # imóvel não encontrado
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db):
        resp = client.get(PREVIEW)
    assert resp.status_code == 404


def test_preview_relatorio_ok(client):
    imovel = MagicMock(data={"id": "abc", "codigo": "MOR-1", "created_at": "2026-05-01T00:00:00+00:00"})
    db = make_db_mock(imovel)
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db), \
         patch("app.routers.imovel_acompanhamento._montar_relatorio",
               return_value=({"codigo": "MOR-1"}, b"%PDF-1.4 fake")):
        resp = client.get(PREVIEW)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "inline" in resp.headers["content-disposition"]
    assert resp.content == b"%PDF-1.4 fake"
