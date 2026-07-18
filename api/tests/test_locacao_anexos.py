"""Testes dos anexos de contrato: Fase 4 do módulo de Locações.

Cobre upload, listagem com URL pública resolvida, e delete que remove
do storage + do banco. O bucket Supabase é mockado para evitar I/O real.
"""
import io
from unittest.mock import MagicMock, patch

from tests.conftest import make_db_mock
from tests.test_locacoes import CONTRATO_DB


CONTRATO_ID = CONTRATO_DB["id"]


def _mock_storage(db_mock, url_publica="https://storage.example/file.pdf"):
    """Anexa um storage mock ao db_mock; retorna o storage para asserts.
    Cobre as duas formas de URL: signed (padrão para anexos) e public (fallback).
    """
    storage_mock = MagicMock()
    storage_mock.upload.return_value = None
    storage_mock.get_public_url.return_value = url_publica
    storage_mock.create_signed_url.return_value = {"signedURL": url_publica}
    storage_mock.remove.return_value = None
    db_mock.storage.from_.return_value = storage_mock
    return storage_mock


# ── Upload ──────────────────────────────────────────────────────────────────

def test_upload_anexo_pdf(client):
    anexo_db = {
        "id": "anexo-1",
        "contrato_id": CONTRATO_ID,
        "tipo": "contrato",
        "nome_arquivo": "contrato.pdf",
        "firebase_path": f"locacoes/{CONTRATO_ID}/abc-contrato.pdf",
        "tamanho_bytes": 123,
        "mime_type": "application/pdf",
        "uploaded_by": "00000000-0000-0000-0000-000000000001",
        "created_at": "2026-05-16T00:00:00+00:00",
    }
    db = make_db_mock(
        MagicMock(data=CONTRATO_DB),    # _buscar_contrato
        MagicMock(data=[anexo_db]),      # insert anexo
    )
    storage = _mock_storage(db)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_ID}/anexos",
            files={"file": ("contrato.pdf", b"%PDF-1.4 fake", "application/pdf")},
            data={"tipo": "contrato"},
        )

    assert res.status_code == 201
    body = res.json()
    assert body["nome_arquivo"] == "contrato.pdf"
    assert body["url"].startswith("https://")
    storage.upload.assert_called_once()


def test_upload_anexo_tipo_nao_permitido(client):
    db = make_db_mock(MagicMock(data=CONTRATO_DB))
    _mock_storage(db)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_ID}/anexos",
            files={"file": ("script.exe", b"MZ", "application/x-msdownload")},
            data={"tipo": "contrato"},
        )

    assert res.status_code == 400
    assert "Tipo não permitido" in res.json()["detail"]


def test_upload_anexo_arquivo_vazio(client):
    db = make_db_mock(MagicMock(data=CONTRATO_DB))
    _mock_storage(db)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_ID}/anexos",
            files={"file": ("vazio.pdf", b"", "application/pdf")},
            data={"tipo": "contrato"},
        )

    assert res.status_code == 400


def test_upload_anexo_arquivo_muito_grande(client):
    """Limite 10 MB, testamos com 10.5 MB."""
    db = make_db_mock(MagicMock(data=CONTRATO_DB))
    _mock_storage(db)
    grande = b"x" * (10 * 1024 * 1024 + 1024)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.post(
            f"/locacoes/{CONTRATO_ID}/anexos",
            files={"file": ("g.pdf", grande, "application/pdf")},
            data={"tipo": "contrato"},
        )

    assert res.status_code == 400


def test_upload_anexo_contrato_inexistente(client):
    db = make_db_mock(MagicMock(data=None))  # _buscar_contrato falha
    _mock_storage(db)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.post(
            "/locacoes/nao-existe/anexos",
            files={"file": ("c.pdf", b"%PDF-", "application/pdf")},
            data={"tipo": "contrato"},
        )

    assert res.status_code == 404


# ── Listagem ────────────────────────────────────────────────────────────────

def test_listar_anexos(client):
    anexos = [
        {
            "id": "a1",
            "contrato_id": CONTRATO_ID,
            "tipo": "contrato",
            "nome_arquivo": "x.pdf",
            "firebase_path": "locacoes/c/a1.pdf",
            "tamanho_bytes": 100,
            "mime_type": "application/pdf",
            "uploaded_by": None,
            "created_at": "2026-05-01T00:00:00+00:00",
        },
    ]
    db = make_db_mock(MagicMock(data=anexos))
    _mock_storage(db, url_publica="https://storage.example/a1.pdf")

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_ID}/anexos")

    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["url"] == "https://storage.example/a1.pdf"


def test_listar_anexos_vazio(client):
    db = make_db_mock(MagicMock(data=[]))
    _mock_storage(db)
    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.get(f"/locacoes/{CONTRATO_ID}/anexos")
    assert res.status_code == 200
    assert res.json() == []


# ── Delete ──────────────────────────────────────────────────────────────────

def test_deletar_anexo(client):
    db = make_db_mock(
        MagicMock(data=[{"firebase_path": "locacoes/c/a1.pdf"}]),  # busca
        MagicMock(data=[]),                                         # delete
    )
    storage = _mock_storage(db)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.delete("/locacoes/anexos/a1")

    assert res.status_code == 204
    storage.remove.assert_called_once_with(["locacoes/c/a1.pdf"])
    db.delete.assert_called_once()


def test_deletar_anexo_inexistente_e_idempotente(client):
    """Anexo já removido → 204 sem chamar storage.remove."""
    db = make_db_mock(MagicMock(data=[]))  # busca vazia
    storage = _mock_storage(db)

    with patch("app.routers.locacoes.supabase_admin", db), \
         patch("app.services.storage.supabase_admin", db):
        res = client.delete("/locacoes/anexos/nao-existe")

    assert res.status_code == 204
    storage.remove.assert_not_called()
