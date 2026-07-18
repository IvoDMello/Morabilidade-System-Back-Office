"""Trilha de auditoria para o módulo de Administração de Locações.

Toda mutação relevante (contrato, pagamento, reajuste, anexo) deve passar
por `registrar_audit_locacao` para deixar rastro de QUEM/QUANDO/O QUE
mudou. A função nunca propaga exceção, falha de auditoria não pode
quebrar a operação principal.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from app.database import supabase_admin

logger = logging.getLogger(__name__)

AcaoAudit = Literal["insert", "update", "delete"]
EntidadeAudit = Literal["contrato", "pagamento", "reajuste", "anexo"]


def _normalizar(valor: Any) -> Any:
    """Converte tipos não-serializáveis em JSON (Decimal, date, datetime)."""
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    if isinstance(valor, dict):
        return {k: _normalizar(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [_normalizar(v) for v in valor]
    return valor


def registrar_audit_locacao(
    *,
    user: Optional[dict],
    acao: AcaoAudit,
    entidade: EntidadeAudit,
    entidade_id: str,
    contrato_id: Optional[str] = None,
    payload_antes: Any = None,
    payload_depois: Any = None,
) -> None:
    """Grava uma linha em locacao_audit_log. Nunca lança."""
    try:
        row = {
            "user_id": (user or {}).get("id"),
            "user_email": (user or {}).get("email"),
            "user_perfil": (user or {}).get("perfil"),
            "acao": acao,
            "entidade": entidade,
            "entidade_id": entidade_id,
            "contrato_id": contrato_id or (
                entidade_id if entidade == "contrato" else None
            ),
            "payload_antes": (
                json.loads(json.dumps(_normalizar(payload_antes)))
                if payload_antes is not None
                else None
            ),
            "payload_depois": (
                json.loads(json.dumps(_normalizar(payload_depois)))
                if payload_depois is not None
                else None
            ),
        }
        supabase_admin.table("locacao_audit_log").insert(row).execute()
    except Exception as e:
        logger.error(
            "Falha ao registrar auditoria (%s/%s id=%s): %s",
            entidade, acao, entidade_id, e,
        )


def registrar_audit_acao(
    *,
    user: Optional[dict],
    metodo: str,
    path: str,
) -> None:
    """Grava uma linha em acao_audit_log para uma ação de escrita.

    Usada no gate de permissão para rastrear QUEM (admin ou corretor)
    disparou cada requisição de alteração. Nunca lança.
    """
    try:
        row = {
            "user_id": (user or {}).get("id"),
            "user_email": (user or {}).get("email"),
            "user_perfil": (user or {}).get("perfil"),
            "metodo": metodo,
            "path": path,
        }
        supabase_admin.table("acao_audit_log").insert(row).execute()
    except Exception as e:
        logger.error("Falha ao registrar auditoria de ação (%s %s): %s", metodo, path, e)
