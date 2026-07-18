"""Testes dos endpoints de analytics, tracking público e dashboard interno."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_db_mock


# ── /publico/track ────────────────────────────────────────────────────────────
# Endpoint mais antigo, mas inclui lógica de bot detection e resolução de
# imovel_codigo que vale travar com teste de regressão.

def test_track_aceita_payload_minimo(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/track",
            json={"session_id": "session1234", "path": "/", "imovel_codigo": None, "referrer": None},
        )
    assert res.status_code == 204
    db.table.assert_called_with("page_views")
    inserido = db.insert.call_args.args[0]
    assert inserido["session_id"] == "session1234"
    assert inserido["imovel_id"] is None
    assert inserido["is_bot"] is False  # UA padrão do TestClient não é bot


def test_track_marca_bot_quando_user_agent_de_bot(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/track",
            json={"session_id": "session1234", "path": "/"},
            headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)"},
        )
    assert db.insert.call_args.args[0]["is_bot"] is True


def test_track_resolve_imovel_codigo_em_id(anon_client):
    # 1ª execute(): lookup do imóvel; 2ª: insert
    db = make_db_mock(
        MagicMock(data=[{"id": "imovel-uuid-1"}]),
        MagicMock(data=[]),
    )
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/track",
            json={"session_id": "session1234", "path": "/imoveis/MB-00001", "imovel_codigo": "MB-00001"},
        )
    inserido = db.insert.call_args.args[0]
    assert inserido["imovel_id"] == "imovel-uuid-1"
    assert inserido["imovel_codigo"] == "MB-00001"


def test_track_ignora_codigo_em_formato_invalido(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/track",
            json={"session_id": "session1234", "path": "/x", "imovel_codigo": "../../../etc/passwd"},
        )
    inserido = db.insert.call_args.args[0]
    assert inserido["imovel_id"] is None
    assert inserido["imovel_codigo"] is None


def test_track_valida_session_id_curto(anon_client):
    res = anon_client.post(
        "/publico/track",
        json={"session_id": "abc", "path": "/"},
    )
    assert res.status_code == 422


# ── /publico/busca ────────────────────────────────────────────────────────────

def test_busca_grava_evento(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/busca",
            json={
                "session_id": "session1234",
                "termo": "  ipanema 3 quartos  ",
                "filtros": {"bairro": ["Ipanema"], "tipo_negocio": "venda"},
                "resultados_count": 4,
            },
        )
    assert res.status_code == 204
    db.table.assert_called_with("search_events")
    inserido = db.insert.call_args.args[0]
    # Termo é trim-ado, filtros são preservados, count é registrado
    assert inserido["termo"] == "ipanema 3 quartos"
    assert inserido["filtros"] == {"bairro": ["Ipanema"], "tipo_negocio": "venda"}
    assert inserido["resultados_count"] == 4


def test_busca_termo_vazio_vira_null(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/busca",
            json={"session_id": "session1234", "termo": "   ", "filtros": {}, "resultados_count": 0},
        )
    assert db.insert.call_args.args[0]["termo"] is None


def test_busca_rejeita_count_negativo(anon_client):
    res = anon_client.post(
        "/publico/busca",
        json={"session_id": "session1234", "filtros": {}, "resultados_count": -1},
    )
    assert res.status_code == 422


# ── /publico/favorito ─────────────────────────────────────────────────────────

def test_favorito_add_resolve_imovel(anon_client):
    db = make_db_mock(
        MagicMock(data=[{"id": "imovel-uuid-1"}]),
        MagicMock(data=[]),
    )
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/favorito",
            json={"session_id": "session1234", "imovel_codigo": "MB-00001", "acao": "add"},
        )
    assert res.status_code == 204
    db.table.assert_called_with("imovel_favoritos")
    inserido = db.insert.call_args.args[0]
    assert inserido["imovel_id"] == "imovel-uuid-1"
    assert inserido["acao"] == "add"


def test_favorito_codigo_invalido_silencioso(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/favorito",
            json={"session_id": "session1234", "imovel_codigo": "lixo", "acao": "add"},
        )
    # 204 mesmo sem inserir, código inválido não deve derrubar o site público.
    assert res.status_code == 204
    db.insert.assert_not_called()


def test_favorito_rejeita_acao_invalida(anon_client):
    res = anon_client.post(
        "/publico/favorito",
        json={"session_id": "session1234", "imovel_codigo": "MB-00001", "acao": "burn"},
    )
    assert res.status_code == 422


# ── /publico/share ────────────────────────────────────────────────────────────

def test_share_grava_canal_valido(anon_client):
    db = make_db_mock(
        MagicMock(data=[{"id": "imovel-uuid-1"}]),
        MagicMock(data=[]),
    )
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/share",
            json={"session_id": "session1234", "imovel_codigo": "MB-00001", "canal": "whatsapp"},
        )
    assert db.insert.call_args.args[0]["canal"] == "whatsapp"


def test_share_canal_nao_whitelist_vira_null(anon_client):
    db = make_db_mock(
        MagicMock(data=[{"id": "imovel-uuid-1"}]),
        MagicMock(data=[]),
    )
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/share",
            json={"session_id": "session1234", "imovel_codigo": "MB-00001", "canal": "carrier_pigeon"},
        )
    assert db.insert.call_args.args[0]["canal"] is None


# ── /publico/video ────────────────────────────────────────────────────────────

def test_video_grava_clique(anon_client):
    db = make_db_mock(
        MagicMock(data=[{"id": "imovel-uuid-1"}]),
        MagicMock(data=[]),
    )
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/video",
            json={"session_id": "session1234", "imovel_codigo": "MB-00001"},
        )
    assert res.status_code == 204
    db.table.assert_called_with("imovel_video_clicks")
    assert db.insert.call_args.args[0]["imovel_id"] == "imovel-uuid-1"


def test_video_codigo_invalido_silencioso(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/video",
            json={"session_id": "session1234", "imovel_codigo": "lixo"},
        )
    assert res.status_code == 204
    db.insert.assert_not_called()


# ── /analytics/dashboard (autenticado) ───────────────────────────────────────

def _dashboard_db(kpis_atual=None, kpis_prev=None):
    """Mock cobrindo as 11 RPCs invocadas pelo endpoint dashboard."""
    kpis_atual = kpis_atual or {
        "visitantes_unicos": 100, "vistas_imovel": 80, "buscas": 30, "favoritos": 12,
    }
    kpis_prev = kpis_prev or {
        "visitantes_unicos": 50, "vistas_imovel": 40, "buscas": 20, "favoritos": 6,
    }
    return make_db_mock(
        MagicMock(data=[kpis_atual]),               # kpis atual
        MagicMock(data=[kpis_prev]),                # kpis prev
        MagicMock(data=[{"dia": "2026-05-30", "visitantes": 10, "views": 25}]),
        MagicMock(data=[{"visitaram": 100, "buscaram": 30, "abriram": 25, "favoritaram": 12}]),
        MagicMock(data=[{"origem": "Instagram", "total": 50}]),
        MagicMock(data=[]),                         # top_imoveis
        MagicMock(data=[]),                         # bairros
        MagicMock(data=[{"dispositivo": "Celular", "total": 90}]),
        MagicMock(data=[]),                         # heatmap
        MagicMock(data=[]),                         # termos
        MagicMock(data=[]),                         # buscas_vazias
    )


def test_dashboard_requer_autenticacao(anon_client):
    res = anon_client.get("/analytics/dashboard")
    assert res.status_code in (401, 403)


def test_dashboard_calcula_delta_percentual(client):
    db = _dashboard_db()
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/dashboard?periodo=30")
    assert res.status_code == 200
    body = res.json()
    # +100% quando dobra (100 vs 50)
    assert body["kpis"]["visitantes_unicos"]["valor"] == 100
    assert body["kpis"]["visitantes_unicos"]["delta"] == 100.0


def test_dashboard_delta_none_quando_periodo_anterior_zerado(client):
    db = _dashboard_db(kpis_prev={
        "visitantes_unicos": 0, "vistas_imovel": 0, "buscas": 0, "favoritos": 0,
    })
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/dashboard?periodo=7")
    body = res.json()
    # Sem base de comparação, delta deve ser None (não inf nem erro)
    assert body["kpis"]["visitantes_unicos"]["delta"] is None


def test_dashboard_periodo_invalido_cai_pra_30(client):
    db = _dashboard_db()
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/dashboard?periodo=999")
    assert res.json()["periodo"] == 30


@pytest.mark.parametrize("periodo", [7, 30, 90, 365])
def test_dashboard_aceita_periodos_validos(client, periodo):
    db = _dashboard_db()
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get(f"/analytics/dashboard?periodo={periodo}")
    assert res.status_code == 200
    assert res.json()["periodo"] == periodo


def test_dashboard_retorna_todas_secoes(client):
    db = _dashboard_db()
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/dashboard")
    body = res.json()
    for secao in (
        "kpis", "serie", "funil", "origem",
        "top_imoveis", "bairros", "dispositivos",
        "heatmap", "termos", "buscas_vazias",
    ):
        assert secao in body
