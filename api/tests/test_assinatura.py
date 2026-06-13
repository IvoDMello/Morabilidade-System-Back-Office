"""Testes dos helpers compartilhados de assinatura (IP, proxy, token, hash, PDF)."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.services import assinatura
from app.services.assinatura import (
    expira_em,
    gerar_token,
    ip_do_request,
    montar_endereco,
    pdf_response,
    sha256_canonico,
    token_expirado,
    xff_bruto,
)


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


# ── Token de assinatura ───────────────────────────────────────────────────────

def test_gerar_token_unico_e_urlsafe():
    a, b = gerar_token(), gerar_token()
    assert a != b
    assert len(a) >= 32
    assert all(c.isalnum() or c in "-_" for c in a)


def test_expira_em_soma_dias():
    agora = datetime(2026, 6, 13, 12, 0, tzinfo=timezone.utc)
    assert expira_em(agora, dias=7) == datetime(2026, 6, 20, 12, 0, tzinfo=timezone.utc).isoformat()


def test_token_expirado_cenarios():
    agora = datetime(2026, 6, 13, 12, 0, tzinfo=timezone.utc)
    passado = (agora - timedelta(days=1)).isoformat()
    futuro = (agora + timedelta(days=1)).isoformat()
    assert token_expirado(passado, agora) is True
    assert token_expirado(futuro, agora) is False
    assert token_expirado(None, agora) is False         # sem data não bloqueia
    assert token_expirado("data-invalida", agora) is False
    # Aceita sufixo Z (UTC) sem quebrar.
    assert token_expirado(passado.replace("+00:00", "Z"), agora) is True


# ── Hash canônico ─────────────────────────────────────────────────────────────

def test_sha256_canonico_estavel_independe_da_ordem_das_chaves():
    h1 = sha256_canonico({"a": 1, "b": 2})
    h2 = sha256_canonico({"b": 2, "a": 1})
    assert h1 == h2
    assert len(h1) == 64
    # Mudar um valor muda o hash.
    assert sha256_canonico({"a": 1, "b": 3}) != h1


# ── Resposta PDF ──────────────────────────────────────────────────────────────

def test_pdf_response_headers_e_corpo():
    resp = pdf_response(b"%PDF-1.4", "doc.pdf")
    assert resp.media_type == "application/pdf"
    assert resp.body == b"%PDF-1.4"
    assert resp.headers["content-disposition"] == 'attachment; filename="doc.pdf"'
    assert "Content-Disposition" in resp.headers["access-control-expose-headers"]
