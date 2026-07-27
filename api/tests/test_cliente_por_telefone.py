"""Testes do casamento de telefone usado pela busca interna de cliente
(GET /clientes/interno/por-telefone/{telefone}), consumida pelo CRM do WhatsApp."""
from app.routers.clientes import _telefone_canonico, _telefones_batem


def test_canonico_tira_ddi_e_formatacao():
    assert _telefone_canonico("(27) 99999-9999") == "27999999999"
    assert _telefone_canonico("5527999999999") == "27999999999"
    assert _telefone_canonico("27999999999") == "27999999999"


def test_batem_mesmo_numero_formatos_diferentes():
    # CRM guarda com DDI 55; a API pode ter salvo formatado sem DDI.
    assert _telefones_batem("5527999999999", "(27) 99999-9999") is True
    assert _telefones_batem("5527999999999", "27999999999") is True


def test_nao_batem_numeros_diferentes():
    assert _telefones_batem("5527999999999", "5527988888888") is False


def test_numero_curto_nunca_bate():
    # Menos de 10 dígitos (sem DDD) não é confiável — evita falso positivo.
    assert _telefones_batem("99999999", "99999999") is False
    assert _telefones_batem(None, "5527999999999") is False
