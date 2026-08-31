"""Testes do endpoint do relatório de visitas do imóvel (download sob demanda).

Foco no contrato: exige imóvel existente, devolve PDF como anexo e monta os
dados só a partir das fichas ASSINADAS, com o telefone mascarado.
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock

ENDPOINT = "/imoveis/abc/relatorio-visitas"

IMOVEL = {
    "id": "abc",
    "codigo": "MOR-1",
    "logradouro": "Rua das Flores",
    "numero": "100",
    "bairro": "Icaraí",
    "cidade": "Niterói",
    "created_at": "2026-05-01T00:00:00+00:00",
}


def test_relatorio_visitas_imovel_inexistente(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db):
        resp = client.get(ENDPOINT)
    assert resp.status_code == 404


def test_relatorio_visitas_ok_baixa_pdf(client):
    db = make_db_mock(MagicMock(data=IMOVEL))
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db), \
         patch("app.routers.imovel_acompanhamento._montar_dados_visitas",
               return_value={"codigo": "MOR-1", "visitas": []}), \
         patch("app.routers.imovel_acompanhamento.gerar_relatorio_visitas_pdf",
               return_value=b"%PDF-1.4 fake"):
        resp = client.get(ENDPOINT)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "relatorio-visitas-MOR-1.pdf" in resp.headers["content-disposition"]
    assert resp.content == b"%PDF-1.4 fake"


def test_relatorio_visitas_falha_na_geracao_vira_502(client):
    db = make_db_mock(MagicMock(data=IMOVEL))
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db), \
         patch("app.routers.imovel_acompanhamento._montar_dados_visitas",
               side_effect=RuntimeError("reportlab caiu")):
        resp = client.get(ENDPOINT)
    assert resp.status_code == 502
    assert "reportlab caiu" in resp.json()["detail"]


def test_montar_dados_visitas_usa_fichas_assinadas():
    """O relatório sai das fichas assinadas, com endereço e datas formatados."""
    from app.routers.imovel_acompanhamento import _montar_dados_visitas

    fichas = MagicMock(data=[
        {"visitante_nome": "Ana Clara de Souza Lima", "visitante_telefone": "(21) 99772-9990",
         "assinada_em": "2026-05-15T14:00:00+00:00", "created_at": "2026-05-14T10:00:00+00:00"},
        {"visitante_nome": "João Pedro", "visitante_telefone": None,
         "assinada_em": None, "created_at": "2026-05-10T10:00:00+00:00"},
    ])
    db = make_db_mock(fichas)
    with patch("app.routers.imovel_acompanhamento.supabase_admin", db):
        dados = _montar_dados_visitas(IMOVEL)

    db.table.assert_called_with("fichas_visita")
    assert dados["codigo"] == "MOR-1"
    assert dados["endereco"] == "Rua das Flores, 100, Icaraí, Niterói"
    # 01/05 00:00 UTC é 30/04 no fuso do Brasil, o fmt_dt converte.
    assert dados["anunciado_em"] == "30/04/2026"
    assert len(dados["visitas"]) == 2
    assert dados["visitas"][0]["data"] == "2026-05-15T14:00:00+00:00"
    # Ficha sem `assinada_em` cai no created_at, para nunca sair sem data.
    assert dados["visitas"][1]["data"] == "2026-05-10T10:00:00+00:00"
