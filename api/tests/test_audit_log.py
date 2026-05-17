"""Testes do helper de auditoria de locações."""
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

from app.services.audit_log import registrar_audit_locacao


def _capturar_insert(db):
    return db.insert.call_args.args[0]


def test_registra_insert_com_user_e_payload_depois():
    db = MagicMock()
    db.table.return_value = db
    db.insert.return_value = db
    db.execute.return_value = MagicMock(data=[{"id": "audit-1"}])

    user = {"id": "u-1", "email": "ivo@ex.com", "perfil": "admin"}
    with patch("app.services.audit_log.supabase_admin", db):
        registrar_audit_locacao(
            user=user,
            acao="insert",
            entidade="contrato",
            entidade_id="c-1",
            payload_depois={"aluguel_mensal": Decimal("8500.00"), "data_inicio": date(2026, 1, 1)},
        )

    row = _capturar_insert(db)
    assert row["user_id"] == "u-1"
    assert row["user_email"] == "ivo@ex.com"
    assert row["user_perfil"] == "admin"
    assert row["acao"] == "insert"
    assert row["entidade"] == "contrato"
    assert row["entidade_id"] == "c-1"
    assert row["contrato_id"] == "c-1"  # default quando entidade=contrato
    assert row["payload_antes"] is None
    # Decimal vira float, date vira string ISO
    assert row["payload_depois"]["aluguel_mensal"] == 8500.0
    assert row["payload_depois"]["data_inicio"] == "2026-01-01"


def test_registra_update_com_antes_e_depois():
    db = MagicMock()
    db.table.return_value = db
    db.insert.return_value = db
    db.execute.return_value = MagicMock(data=[{"id": "audit-2"}])

    with patch("app.services.audit_log.supabase_admin", db):
        registrar_audit_locacao(
            user={"id": "u-1", "email": "a@x", "perfil": "admin"},
            acao="update",
            entidade="pagamento",
            entidade_id="p-1",
            contrato_id="c-1",
            payload_antes={"status": "pendente"},
            payload_depois={"status": "pago"},
        )

    row = _capturar_insert(db)
    assert row["acao"] == "update"
    assert row["entidade"] == "pagamento"
    assert row["contrato_id"] == "c-1"
    assert row["payload_antes"] == {"status": "pendente"}
    assert row["payload_depois"] == {"status": "pago"}


def test_falha_do_banco_nao_propaga():
    """Auditoria nunca pode derrubar a operação principal."""
    db = MagicMock()
    db.table.return_value = db
    db.insert.return_value = db
    db.execute.side_effect = Exception("connection refused")

    with patch("app.services.audit_log.supabase_admin", db):
        # Não deve lançar
        registrar_audit_locacao(
            user={"id": "u-1", "email": "x", "perfil": "admin"},
            acao="delete",
            entidade="anexo",
            entidade_id="a-1",
        )


def test_user_none_grava_campos_nulos():
    db = MagicMock()
    db.table.return_value = db
    db.insert.return_value = db
    db.execute.return_value = MagicMock(data=[])

    with patch("app.services.audit_log.supabase_admin", db):
        registrar_audit_locacao(
            user=None,
            acao="insert",
            entidade="reajuste",
            entidade_id="r-1",
            contrato_id="c-1",
        )

    row = _capturar_insert(db)
    assert row["user_id"] is None
    assert row["user_email"] is None
    assert row["user_perfil"] is None
