"""Testes dos helpers compartilhados de assinatura (IP real + cadeia de proxy)."""
from unittest.mock import MagicMock

from app.services import assinatura
from app.services.assinatura import ip_do_request, montar_endereco, xff_bruto


def _request(xff=None, client_host="10.0.0.1"):
    req = MagicMock()
    req.headers = {"x-forwarded-for": xff} if xff is not None else {}
    req.client = MagicMock(host=client_host) if client_host else None
    return req


# ── ip_do_request: extração resistente a spoof ────────────────────────────────

def test_ip_real_e_o_penultimo_com_2_hops():
    # Cenário Railway confirmado: cliente, borda. IP real = xff[-2].
    req = _request("177.27.22.222, 89.222.103.194")
    assert ip_do_request(req, trusted_hops=2) == "177.27.22.222"


def test_ip_ignora_entrada_forjada_a_esquerda():
    # Cliente injeta um XFF falso; a borda acrescenta o IP real depois.
    # Com 2 hops, o real continua em xff[-2], não o forjado em xff[0].
    req = _request("6.6.6.6, 177.27.22.222, 89.222.103.194")
    assert ip_do_request(req, trusted_hops=2) == "177.27.22.222"


def test_ip_cadeia_mais_curta_que_hops_usa_primeiro():
    req = _request("177.27.22.222")
    assert ip_do_request(req, trusted_hops=2) == "177.27.22.222"


def test_ip_sem_xff_cai_no_client_host():
    req = _request(xff=None, client_host="192.168.0.5")
    assert ip_do_request(req, trusted_hops=2) == "192.168.0.5"


def test_ip_sem_xff_sem_client_retorna_none():
    req = _request(xff=None, client_host=None)
    assert ip_do_request(req, trusted_hops=2) is None


def test_ip_xff_com_espacos_e_vazios():
    req = _request("  1.1.1.1 ,  , 2.2.2.2 , 3.3.3.3 ")
    # partes válidas: [1.1.1.1, 2.2.2.2, 3.3.3.3]; -2 = 2.2.2.2
    assert ip_do_request(req, trusted_hops=2) == "2.2.2.2"


def test_ip_usa_trusted_hops_da_config_por_padrao(monkeypatch):
    monkeypatch.setattr(assinatura.settings, "trusted_proxy_hops", 1)
    req = _request("1.1.1.1, 2.2.2.2")
    assert ip_do_request(req) == "2.2.2.2"  # -1 com 1 hop
    monkeypatch.setattr(assinatura.settings, "trusted_proxy_hops", 2)
    assert ip_do_request(req) == "1.1.1.1"  # -2 com 2 hops


def test_hops_minimo_de_1():
    req = _request("1.1.1.1, 2.2.2.2")
    assert ip_do_request(req, trusted_hops=0) == "2.2.2.2"  # clamp para 1 -> xff[-1]


# ── xff_bruto ─────────────────────────────────────────────────────────────────

def test_xff_bruto_preserva_cadeia():
    req = _request("1.1.1.1, 2.2.2.2")
    assert xff_bruto(req) == "1.1.1.1, 2.2.2.2"


def test_xff_bruto_none_sem_header():
    assert xff_bruto(_request(xff=None)) is None


def test_xff_bruto_truncado():
    longo = ", ".join(["1.2.3.4"] * 200)
    assert len(xff_bruto(_request(longo))) <= 500


# ── montar_endereco ───────────────────────────────────────────────────────────

def test_montar_endereco_completo():
    imovel = {"logradouro": "Rua A", "numero": 100, "complemento": "ap 2"}
    assert montar_endereco(imovel) == "Rua A, 100, ap 2"


def test_montar_endereco_ignora_vazios():
    assert montar_endereco({"logradouro": "Rua A", "numero": None}) == "Rua A"
