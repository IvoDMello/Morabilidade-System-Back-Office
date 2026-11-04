"""Testes dos endpoints de analytics, tracking público e dashboard interno."""
from datetime import date, datetime, timedelta
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


# ── /publico/morametrica ──────────────────────────────────────────────────────

def test_morametrica_grava_busca(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        res = anon_client.post(
            "/publico/morametrica",
            json={"session_id": "session1234", "tipo": "unidade"},
        )
    assert res.status_code == 204
    db.table.assert_called_with("morametrica_buscas")
    inserido = db.insert.call_args.args[0]
    assert inserido == {"session_id": "session1234", "tipo": "unidade", "is_bot": False}


def test_morametrica_marca_bot(anon_client):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        anon_client.post(
            "/publico/morametrica",
            json={"session_id": "session1234", "tipo": "predio"},
            headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)"},
        )
    assert db.insert.call_args.args[0]["is_bot"] is True


def test_morametrica_rejeita_tipo_desconhecido(anon_client):
    # O endereço buscado nunca é aceito no lugar do tipo
    res = anon_client.post(
        "/publico/morametrica",
        json={"session_id": "session1234", "tipo": "Rua Bom Pastor, 521"},
    )
    assert res.status_code == 422


# ── /analytics/dashboard (autenticado) ───────────────────────────────────────

HOJE = date(2026, 11, 2)


@pytest.fixture
def hoje_fixo():
    """O painel conta dias fechados até ontem: fixa o "hoje" de Brasília."""
    relogio = MagicMock(wraps=datetime)
    relogio.now.return_value = datetime(2026, 11, 2, 15, 0)
    with patch("app.routers.analytics.datetime", relogio):
        yield


def _dia(d: date, **valores) -> dict:
    """Linha de analytics_dias, com zero no que não for informado."""
    linha = {
        "dia": d.isoformat(), "visitas": 0, "acessos": 0, "vistas_imovel": 0,
        "buscas": 0, "favoritos": 0, "mm_visitas": 0, "mm_acessos": 0,
        "mm_buscas": 0, "mm_sem_resultado": 0, "origens": {},
    }
    linha.update(valores)
    return linha


def _historico(desde: date, ate: date, **valores) -> list:
    return [_dia(desde + timedelta(days=i), **valores) for i in range((ate - desde).days + 1)]


def _dashboard_db(dias: list):
    """Mock: analytics_dias primeiro, depois as 7 RPCs de detalhe."""
    return make_db_mock(
        MagicMock(data=dias),
        MagicMock(data=[{"visitaram": 100, "buscaram": 30, "abriram": 25, "favoritaram": 12}]),
        MagicMock(data=[]),                         # top_imoveis
        MagicMock(data=[]),                         # bairros
        MagicMock(data=[{"dispositivo": "Celular", "total": 90}]),
        MagicMock(data=[]),                         # heatmap
        MagicMock(data=[]),                         # termos
        MagicMock(data=[]),                         # buscas_vazias
    )


# periodo=7 com hoje = 02/11: atual = 26/10 a 01/11, anterior = 19/10 a 25/10.
ANTERIOR_7 = _historico(date(2026, 10, 19), date(2026, 10, 25), visitas=5, acessos=12)
ATUAL_7 = _historico(date(2026, 10, 26), date(2026, 11, 1), visitas=10, acessos=30, mm_buscas=4)


def test_dashboard_requer_autenticacao(anon_client):
    res = anon_client.get("/analytics/dashboard")
    assert res.status_code in (401, 403)


def test_dashboard_pede_os_dois_periodos_e_hoje(client, hoje_fixo):
    db = _dashboard_db([])
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=7").json()
    db.rpc.assert_any_call("analytics_dias", {"p_desde": "2026-10-19", "p_ate": "2026-11-02"})
    assert (body["inicio"], body["fim"]) == ("2026-10-26", "2026-11-01")


def test_dashboard_soma_periodo_e_calcula_delta(client, hoje_fixo):
    db = _dashboard_db(ANTERIOR_7 + ATUAL_7 + [_dia(HOJE, visitas=3, acessos=8, mm_buscas=2)])
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=7").json()
    # Hoje fica fora da soma: 7 dias × 10 visitas, contra 7 × 5 no período anterior
    assert body["kpis"]["visitas"] == {"valor": 70, "delta": 100.0}
    assert body["kpis"]["acessos"] == {"valor": 210, "delta": 150.0}
    assert len(body["serie"]) == 7
    assert body["hoje"]["visitas"] == 3
    assert body["hoje"]["mm_buscas"] == 2


def test_dashboard_morametrica(client, hoje_fixo):
    db = _dashboard_db(ANTERIOR_7 + ATUAL_7)
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=7").json()
    assert body["morametrica"]["buscas"]["valor"] == 28
    # Período anterior sem nenhuma busca: sem base de comparação
    assert body["morametrica"]["buscas"]["delta"] is None
    assert body["serie"][0]["mm_buscas"] == 4
    assert body["hoje"] is None


def test_dashboard_delta_none_quando_historico_nao_cobre_periodo_anterior(client, hoje_fixo):
    # Histórico começa no meio do período anterior: comparar daria um salto falso
    dias = _historico(date(2026, 10, 23), date(2026, 10, 25), visitas=5) + ATUAL_7
    db = _dashboard_db(dias)
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=7").json()
    assert body["kpis"]["visitas"] == {"valor": 70, "delta": None}
    assert body["historico_desde"] == "2026-10-23"


def test_dashboard_delta_none_quando_periodo_anterior_zerado(client, hoje_fixo):
    dias = _historico(date(2026, 10, 19), date(2026, 10, 25)) + ATUAL_7
    db = _dashboard_db(dias)
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=7").json()
    # Sem base de comparação, delta deve ser None (não inf nem erro)
    assert body["kpis"]["visitas"]["delta"] is None


def test_dashboard_soma_origens_do_periodo(client, hoje_fixo):
    dias = [
        _dia(date(2026, 10, 31), origens={"Instagram": 4, "Google · Orgânico": 1}),
        _dia(date(2026, 11, 1), origens={"Instagram": 2, "Acesso direto": 3}),
        _dia(HOJE, origens={"YouTube": 50}),  # hoje não entra
    ]
    db = _dashboard_db(dias)
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=7").json()
    assert body["origem"] == [
        {"origem": "Instagram", "total": 6},
        {"origem": "Acesso direto", "total": 3},
        {"origem": "Google · Orgânico", "total": 1},
    ]


def test_dashboard_detalhe_limitado_a_90_dias(client, hoje_fixo):
    db = _dashboard_db([])
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard?periodo=365").json()
    assert body["detalhe_dias"] == 90
    db.rpc.assert_any_call("analytics_funil", {"dias": 90})
    db.rpc.assert_any_call("analytics_heatmap", {"dias": 90})
    # As contagens não têm esse limite: pedem os 365 dias e os 365 anteriores
    db.rpc.assert_any_call("analytics_dias", {"p_desde": "2024-11-02", "p_ate": "2026-11-02"})


def test_dashboard_periodo_invalido_cai_pra_30(client):
    db = _dashboard_db([])
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/dashboard?periodo=999")
    assert res.json()["periodo"] == 30


@pytest.mark.parametrize("periodo", [7, 30, 90, 365])
def test_dashboard_aceita_periodos_validos(client, periodo):
    db = _dashboard_db([])
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get(f"/analytics/dashboard?periodo={periodo}")
    assert res.status_code == 200
    assert res.json()["periodo"] == periodo


def test_dashboard_retorna_todas_secoes(client, hoje_fixo):
    db = _dashboard_db(ATUAL_7)
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/dashboard")
    body = res.json()
    for secao in (
        "kpis", "morametrica", "hoje", "serie", "funil", "origem",
        "top_imoveis", "bairros", "dispositivos",
        "heatmap", "termos", "buscas_vazias",
    ):
        assert secao in body


def test_dashboard_informa_ate_quando_leu(client, hoje_fixo):
    db = _dashboard_db([])
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/dashboard").json()
    assert body["atualizado_em"] == "2026-11-02T15:00:00"


# ── /analytics/morametrica/dia ───────────────────────────────────────────────

def test_morametrica_dia_requer_autenticacao(anon_client):
    res = anon_client.get("/analytics/morametrica/dia?dia=2026-11-01")
    assert res.status_code in (401, 403)


def test_morametrica_dia_passado_vem_completo(client, hoje_fixo):
    linha = _dia(date(2026, 11, 1), mm_visitas=21, mm_acessos=44, mm_buscas=7, mm_sem_resultado=1, visitas=999)
    db = make_db_mock(MagicMock(data=[linha]))
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/morametrica/dia?dia=2026-11-01").json()
    db.rpc.assert_called_once_with("analytics_dias", {"p_desde": "2026-11-01", "p_ate": "2026-11-01"})
    assert body == {
        "dia": "2026-11-01",
        "completo": True,
        "atualizado_em": "2026-11-02T15:00:00",
        "numeros": {"visitas": 21, "acessos": 44, "buscas": 7, "sem_resultado": 1},
    }


def test_morametrica_dia_de_hoje_vem_ate_agora(client, hoje_fixo):
    db = make_db_mock(MagicMock(data=[_dia(HOJE, mm_buscas=12)]))
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/morametrica/dia?dia=2026-11-02").json()
    assert body["completo"] is False
    assert body["numeros"]["buscas"] == 12


def test_morametrica_dia_antes_do_historico(client, hoje_fixo):
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.routers.analytics.supabase_admin", db):
        body = client.get("/analytics/morametrica/dia?dia=2026-01-10").json()
    assert body["numeros"] is None


def test_morametrica_dia_futuro_recusado(client, hoje_fixo):
    db = make_db_mock()
    with patch("app.routers.analytics.supabase_admin", db):
        res = client.get("/analytics/morametrica/dia?dia=2026-11-03")
    assert res.status_code == 422
    db.rpc.assert_not_called()


@pytest.mark.parametrize("dia", ["", "03/11/2026", "2026-13-01"])
def test_morametrica_dia_invalido(client, dia):
    res = client.get(f"/analytics/morametrica/dia?dia={dia}")
    assert res.status_code == 422
