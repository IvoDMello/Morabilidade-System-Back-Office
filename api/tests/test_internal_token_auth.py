"""Testes do atalho de integração server-to-server (X-Internal-Token).

Cobre `require_admin_or_internal`: o token de integração libera escrita sem
exigir perfil, mas o tráfego normal continua exigindo admin/corretor.
"""
import pytest
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from app.auth import dependencies
from app.auth.dependencies import (
    USUARIO_INTEGRACAO,
    require_admin_or_internal,
    _token_integracao_valido,
)
from tests.conftest import ADMIN_USER, REGULAR_USER

TOKEN = "segredo-de-integracao"


def _request(headers: dict | None = None) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/imoveis/",
        "headers": raw,
        "query_string": b"",
        "client": ("test", 0),
    }
    return Request(scope)


def _bearer(token: str = "qualquer") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


# ── _token_integracao_valido ─────────────────────────────────────────────────

def test_token_integracao_valido_compara_segredo():
    with patch.object(dependencies.settings, "internal_api_token", TOKEN):
        assert _token_integracao_valido(_request({"X-Internal-Token": TOKEN})) is True
        assert _token_integracao_valido(_request({"X-Internal-Token": "errado"})) is False
        assert _token_integracao_valido(_request({})) is False


def test_token_integracao_desligado_quando_secret_vazio():
    """Sem segredo configurado, nenhum header habilita o atalho."""
    with patch.object(dependencies.settings, "internal_api_token", ""):
        assert _token_integracao_valido(_request({"X-Internal-Token": ""})) is False
        assert _token_integracao_valido(_request({"X-Internal-Token": "x"})) is False


# ── require_admin_or_internal ────────────────────────────────────────────────

def test_token_interno_valido_libera_sem_perfil():
    with patch.object(dependencies.settings, "internal_api_token", TOKEN), \
         patch.object(dependencies, "registrar_audit_acao") as audit:
        user = require_admin_or_internal(
            _request({"X-Internal-Token": TOKEN}), credentials=None
        )
    assert user is USUARIO_INTEGRACAO
    assert user["perfil"] == "integracao"
    audit.assert_called_once()  # deixa rastro mesmo sem usuário humano


def test_sem_token_e_sem_credencial_401():
    with patch.object(dependencies.settings, "internal_api_token", TOKEN):
        with pytest.raises(HTTPException) as exc:
            require_admin_or_internal(_request({}), credentials=None)
    assert exc.value.status_code == 401


def test_token_interno_invalido_cai_no_fluxo_normal_e_exige_perfil():
    """Header errado + usuário comum (não admin/corretor) → 403."""
    usuario_comum = {**REGULAR_USER, "perfil": "assistente"}
    with patch.object(dependencies.settings, "internal_api_token", TOKEN), \
         patch.object(dependencies, "_usuario_do_token", return_value=usuario_comum):
        with pytest.raises(HTTPException) as exc:
            require_admin_or_internal(
                _request({"X-Internal-Token": "errado"}), credentials=_bearer()
            )
    assert exc.value.status_code == 403


def test_usuario_admin_sem_token_continua_funcionando():
    with patch.object(dependencies.settings, "internal_api_token", TOKEN), \
         patch.object(dependencies, "_usuario_do_token", return_value=ADMIN_USER), \
         patch.object(dependencies, "registrar_audit_acao") as audit:
        user = require_admin_or_internal(_request({}), credentials=_bearer())
    assert user == ADMIN_USER
    audit.assert_called_once()
