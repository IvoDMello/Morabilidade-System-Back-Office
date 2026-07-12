"""Testes da chave do rate limit — deve usar o IP real atrás do proxy."""
from unittest.mock import MagicMock

from app.limiter import ip_real_do_cliente, limiter


def _request(xff=None, client_host="10.0.0.1"):
    req = MagicMock()
    req.headers = {"x-forwarded-for": xff} if xff is not None else {}
    req.client = MagicMock(host=client_host) if client_host else None
    return req


def test_chave_usa_ip_real_do_xff_e_nao_o_do_proxy():
    # Cenário Railway (2 hops): sem isso, todos os clientes cairiam no mesmo
    # balde (IP do load balancer) e o limite não protegeria nada.
    req = _request("177.27.22.222, 89.222.103.194")
    assert ip_real_do_cliente(req) == "177.27.22.222"


def test_clientes_diferentes_geram_chaves_diferentes():
    a = _request("1.1.1.1, 89.222.103.194")
    b = _request("2.2.2.2, 89.222.103.194")
    assert ip_real_do_cliente(a) != ip_real_do_cliente(b)


def test_sem_xff_cai_no_client_host():
    assert ip_real_do_cliente(_request()) == "10.0.0.1"


def test_sem_nenhuma_origem_retorna_unknown():
    # slowapi exige string como chave — None quebraria o middleware.
    assert ip_real_do_cliente(_request(client_host=None)) == "unknown"


def test_limiter_esta_configurado_com_a_chave_correta():
    assert limiter._key_func is ip_real_do_cliente
