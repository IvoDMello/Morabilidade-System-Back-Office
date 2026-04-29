"""
Configuração global de testes.

Este módulo define variáveis de ambiente e mocka módulos externos (Firebase,
Supabase) ANTES que qualquer código da aplicação seja importado, evitando
conexões reais com serviços externos durante os testes.
"""
import os
import sys
from unittest.mock import MagicMock

# ── 1. Variáveis de ambiente de teste ────────────────────────────────────────
os.environ.update({
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_ANON_KEY": "fake_anon_key",
    "SUPABASE_SERVICE_ROLE_KEY": "fake_service_role_key",
    "SUPABASE_JWT_SECRET": "test_jwt_secret_must_be_at_least_32_characters_long",
    "RESEND_API_KEY": "test_resend_key",
    "APP_SECRET_KEY": "test_app_secret_key_for_tests_only",
    "APP_ENV": "test",
})

# ── 2. Mock do Supabase antes de qualquer import da app ──────────────────────
# Supabase valida o JWT no construtor — substituímos o módulo inteiro.
_supabase_mock = MagicMock()
_supabase_mock.create_client.return_value = MagicMock()
sys.modules["supabase"] = _supabase_mock

# ── 3. Imports (após mocks) ───────────────────────────────────────────────────
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.auth.dependencies import get_current_user, require_admin

# ── Usuários de teste ────────────────────────────────────────────────────────

ADMIN_USER = {
    "id": "00000000-0000-0000-0000-000000000001",
    "nome_completo": "Admin Teste",
    "email": "admin@teste.com",
    "perfil": "admin",
    "ativo": True,
    "telefone": None,
    "foto_url": None,
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
}

REGULAR_USER = {
    "id": "00000000-0000-0000-0000-000000000002",
    "nome_completo": "Usuário Teste",
    "email": "usuario@teste.com",
    "perfil": "corretor",
    "ativo": True,
    "telefone": None,
    "foto_url": None,
    "created_at": "2025-01-01T00:00:00+00:00",
    "updated_at": "2025-01-01T00:00:00+00:00",
}

# ── Fixtures de clientes HTTP ────────────────────────────────────────────────

@pytest.fixture
def client():
    """
    Cliente autenticado como administrador (perfil padrão para a maioria dos testes).

    Como o modelo de permissões é admin (escrita+leitura) ou corretor (só leitura),
    o `client` representa o caso comum em que a operação requer escrita. Para
    testar restrições de leitura/escrita, use `corretor_client`.
    """
    app.dependency_overrides[get_current_user] = lambda: ADMIN_USER
    app.dependency_overrides[require_admin] = lambda: ADMIN_USER
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client():
    """Alias semântico para `client` — uso explícito quando o teste foca em ações admin-only."""
    app.dependency_overrides[get_current_user] = lambda: ADMIN_USER
    app.dependency_overrides[require_admin] = lambda: ADMIN_USER
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def corretor_client():
    """Cliente autenticado como corretor (perfil somente leitura)."""
    app.dependency_overrides[get_current_user] = lambda: REGULAR_USER
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    """Cliente sem autenticação."""
    app.dependency_overrides.clear()
    yield TestClient(app)


# ── Utilitário: mock do Supabase ─────────────────────────────────────────────

_FALLBACK = MagicMock(data=None, count=0)


def make_db_mock(*results):
    """
    Cria um mock do supabase_admin com interface fluente.

    Cada argumento em `results` é retornado sequencialmente nas chamadas
    a `.execute()`. Chamadas além do esperado retornam um resultado vazio
    para evitar StopIteration em async contexts.

    Uso:
        count_res = MagicMock(count=3, data=[])
        data_res  = MagicMock(count=3, data=[...])
        db = make_db_mock(count_res, data_res)
        with patch("app.routers.imoveis.supabase_admin", db):
            ...
    """
    mock = MagicMock()
    for method in (
        "table", "select", "insert", "update", "delete",
        "eq", "neq", "ilike", "gte", "lte", "in_",
        "order", "range", "single", "maybe_single", "limit", "rpc",
    ):
        getattr(mock, method).return_value = mock
    # Filtros encadeados via sub-objeto (ex: .not_.is_("col", "null"))
    mock.not_.is_.return_value = mock
    # Padeia com fallback para evitar StopIteration em chamadas extras
    padded = list(results) + [_FALLBACK] * 10
    mock.execute.side_effect = padded
    return mock
