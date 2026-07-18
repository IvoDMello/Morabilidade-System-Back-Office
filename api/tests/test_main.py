"""Testes de /health, /stats e /relatorios.

Desde a migration 032, /stats e /relatorios delegam toda a agregação para
RPCs no Postgres (`stats_dashboard()` e `relatorios_dashboard()`). Os
testes aqui verificam que a RPC certa é chamada e o payload da RPC é
devolvido sem transformação. A correção das agregações em si é
responsabilidade do SQL (testado em prod via assertions sobre os campos).
"""
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock


# ── /health (Railway healthcheck) ─────────────────────────────────────────────

def test_health_ok_quando_supabase_responde(anon_client):
    db = make_db_mock(MagicMock(count=1, data=[]))
    with patch("app.main.supabase_admin", db):
        res = anon_client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_503_quando_supabase_quebra(anon_client):
    db = MagicMock()
    db.table.side_effect = ConnectionError("supabase down")
    with patch("app.main.supabase_admin", db):
        res = anon_client.get("/health")
    # Railway precisa ver 503 pra não enviar tráfego pra worker com banco fora.
    assert res.status_code == 503


# ── /stats ────────────────────────────────────────────────────────────────────

_STATS_PAYLOAD = {
    "total_imoveis": 7,
    "imoveis_disponiveis": 4,
    "imoveis_reservados": 2,
    "imoveis_sem_foto": 1,
    "total_clientes": 15,
    "clientes_em_negociacao": 3,
    "leads_ultimos_7_dias": 6,
    "imovel_mais_antigo": {"codigo": "MB-00001", "created_at": "2024-01-01T00:00:00+00:00"},
}


def test_stats_chama_rpc_stats_dashboard(client):
    db = make_db_mock(MagicMock(data=_STATS_PAYLOAD))
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")
    assert res.status_code == 200
    # 1 query só, substituiu as 9 anteriores.
    db.rpc.assert_called_once_with("stats_dashboard")


def test_stats_devolve_payload_da_rpc(client):
    db = make_db_mock(MagicMock(data=_STATS_PAYLOAD))
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")
    body = res.json()
    for campo, valor in _STATS_PAYLOAD.items():
        assert body[campo] == valor


def test_stats_rpc_vazia_vira_objeto_vazio(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.main.supabase_admin", db):
        res = client.get("/stats")
    assert res.status_code == 200
    assert res.json() == {}


def test_stats_exige_autenticacao(anon_client):
    res = anon_client.get("/stats")
    assert res.status_code == 403


def test_stats_acessivel_por_corretor(corretor_client):
    db = make_db_mock(MagicMock(data=_STATS_PAYLOAD))
    with patch("app.main.supabase_admin", db):
        res = corretor_client.get("/stats")
    assert res.status_code == 200


# ── /relatorios ───────────────────────────────────────────────────────────────

_RELATORIOS_PAYLOAD = {
    "meses_labels": [
        "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
        "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
    ],
    "imoveis_por_mes": {"2026-05": 4, "2026-06": 2},
    "clientes_por_mes": {"2026-05": 10, "2026-06": 5},
    "imoveis_por_tipo": {"apartamento": 12, "casa": 3},
    "imoveis_por_tipo_negocio": {"venda": 10, "locacao": 5},
    "imoveis_por_disponibilidade": {"disponivel": 12, "vendido": 3},
    "top_bairros": {"Ipanema": 5, "Leblon": 3},
    "preco_medio_por_tipo": {"apartamento": 1_500_000, "casa": 3_000_000},
    "clientes_por_status": {"ativo": 12, "em_negociacao": 3},
    "clientes_por_origem": {"whatsapp": 8, "instagram": 5, "indicacao": 2},
}


def test_relatorios_chama_rpc_relatorios_dashboard(client):
    db = make_db_mock(MagicMock(data=_RELATORIOS_PAYLOAD))
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")
    assert res.status_code == 200
    db.rpc.assert_called_once_with("relatorios_dashboard")


def test_relatorios_devolve_payload_da_rpc(client):
    db = make_db_mock(MagicMock(data=_RELATORIOS_PAYLOAD))
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")
    body = res.json()
    # Todos os campos do payload da RPC devem chegar inalterados.
    for campo in _RELATORIOS_PAYLOAD:
        assert campo in body
    assert body["meses_labels"] == _RELATORIOS_PAYLOAD["meses_labels"]
    assert body["top_bairros"] == _RELATORIOS_PAYLOAD["top_bairros"]
    assert body["preco_medio_por_tipo"]["apartamento"] == 1_500_000


def test_relatorios_rpc_vazia_vira_objeto_vazio(client):
    db = make_db_mock(MagicMock(data=None))
    with patch("app.main.supabase_admin", db):
        res = client.get("/relatorios")
    assert res.status_code == 200
    assert res.json() == {}


def test_relatorios_exige_autenticacao(anon_client):
    res = anon_client.get("/relatorios")
    assert res.status_code == 403


def test_relatorios_acessivel_por_corretor(corretor_client):
    db = make_db_mock(MagicMock(data=_RELATORIOS_PAYLOAD))
    with patch("app.main.supabase_admin", db):
        res = corretor_client.get("/relatorios")
    assert res.status_code == 200
