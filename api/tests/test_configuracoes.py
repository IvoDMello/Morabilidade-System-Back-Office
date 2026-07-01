"""Testes do módulo de configurações globais (tabela chave/valor `configuracoes`).

Cobre o serviço (get/set/upsert) e os endpoints de dados de recebimento usados
pelo Demonstrativo de Administração.
"""
from unittest.mock import MagicMock, patch

from app.services import configuracoes as svc
from tests.conftest import make_db_mock


# ── Serviço ──────────────────────────────────────────────────────────────────

def test_get_config_vazio_retorna_dict_vazio():
    db = make_db_mock(MagicMock(data=[]))
    with patch("app.services.configuracoes.supabase_admin", db):
        assert svc.get_config("qualquer") == {}


def test_get_config_retorna_valor_jsonb():
    db = make_db_mock(MagicMock(data=[{"valor": {"titular": "Rodrigo"}}]))
    with patch("app.services.configuracoes.supabase_admin", db):
        assert svc.get_config("dados_recebimento") == {"titular": "Rodrigo"}


def test_set_config_usa_upsert_em_uma_chamada():
    """#6: grava via upsert nativo (uma ida ao banco), sem select prévio."""
    db = make_db_mock(MagicMock(data=[{}]))
    with patch("app.services.configuracoes.supabase_admin", db):
        out = svc.set_config("dados_recebimento", {"banco": "Bradesco"})

    assert out == {"banco": "Bradesco"}
    db.upsert.assert_called_once()
    payload, kwargs = db.upsert.call_args.args, db.upsert.call_args.kwargs
    assert payload[0] == {"chave": "dados_recebimento", "valor": {"banco": "Bradesco"}}
    assert kwargs.get("on_conflict") == "chave"
    db.select.assert_not_called()  # sem get-then-write


# ── Endpoints ────────────────────────────────────────────────────────────────

def test_ler_dados_recebimento(client):
    db = make_db_mock(MagicMock(data=[{"valor": {"titular": "Rodrigo", "banco": "Bradesco"}}]))
    with patch("app.services.configuracoes.supabase_admin", db):
        res = client.get("/configuracoes/dados-recebimento")

    assert res.status_code == 200
    body = res.json()
    assert body["titular"] == "Rodrigo"
    assert body["banco"] == "Bradesco"
    assert body["pix"] == ""  # default do schema


def test_atualizar_dados_recebimento_mescla_campos(client):
    """PUT com exclude_unset: campos não enviados preservam o valor atual."""
    db = make_db_mock(
        MagicMock(data=[{"valor": {"titular": "Rodrigo", "banco": "Bradesco",
                                   "agencia": "1745", "conta": "1-0", "pix": "x"}}]),
        MagicMock(data=[{}]),  # upsert
    )
    with patch("app.services.configuracoes.supabase_admin", db):
        res = client.put("/configuracoes/dados-recebimento", json={"pix": "novo@pix"})

    assert res.status_code == 200
    body = res.json()
    assert body["pix"] == "novo@pix"
    assert body["titular"] == "Rodrigo"  # preservado
    # O valor gravado no upsert é o dict mesclado
    gravado = db.upsert.call_args.args[0]["valor"]
    assert gravado["pix"] == "novo@pix"
    assert gravado["banco"] == "Bradesco"


def test_atualizar_dados_recebimento_permitido_para_corretor(corretor_client):
    """require_admin no projeto libera escrita a admin e corretor (PERFIS_ESCRITA)."""
    db = make_db_mock(
        MagicMock(data=[{"valor": {}}]),  # get_dados_recebimento
        MagicMock(data=[{}]),             # upsert
    )
    with patch("app.services.configuracoes.supabase_admin", db):
        res = corretor_client.put("/configuracoes/dados-recebimento", json={"pix": "x"})
    assert res.status_code == 200


def test_atualizar_dados_recebimento_bloqueia_anonimo(anon_client):
    res = anon_client.put("/configuracoes/dados-recebimento", json={"pix": "x"})
    assert res.status_code in (401, 403)
