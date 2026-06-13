"""Testes do serviço de storage (upload/processamento de imagem e documentos).

Usa imagens reais minúsculas geradas em memória (não mocka o PIL) para exercer
de verdade os guards de tipo/tamanho/bomba e o pipeline de marca d'água, e mocka
apenas o cliente do Supabase Storage.
"""
import asyncio
import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from PIL import Image
from starlette.datastructures import Headers, UploadFile

from app.services import storage


# ── Helpers ───────────────────────────────────────────────────────────────────

def _img_bytes(size=(12, 10), mode="RGB", fmt="PNG") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, color=(123, 200, 80) if mode == "RGB" else 255).save(out, format=fmt)
    return out.getvalue()


def _upload_file(contents: bytes, content_type: str, filename="foto.png") -> UploadFile:
    return UploadFile(
        file=io.BytesIO(contents),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def _storage_mock():
    """Retorna (supabase_admin_mock, bucket_mock)."""
    db = MagicMock()
    bucket = MagicMock()
    db.storage.from_.return_value = bucket
    bucket.get_public_url.return_value = "https://proj.supabase.co/storage/v1/object/public/media/x.jpg"
    return db, bucket


def _run(coro):
    return asyncio.run(coro)


# ── upload_foto: validações de entrada ────────────────────────────────────────

def test_upload_foto_rejeita_tipo_invalido():
    f = _upload_file(b"x", "application/pdf", "doc.pdf")
    with pytest.raises(HTTPException) as exc:
        _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert exc.value.status_code == 400
    assert "Tipo não permitido" in exc.value.detail


def test_upload_foto_rejeita_arquivo_vazio():
    f = _upload_file(b"", "image/png")
    with pytest.raises(HTTPException) as exc:
        _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert exc.value.status_code == 400
    assert "vazio" in exc.value.detail.lower()


def test_upload_foto_rejeita_arquivo_grande():
    grande = b"\x89PNG" + b"0" * (storage.PHOTO_MAX_BYTES + 1)
    f = _upload_file(grande, "image/png")
    with pytest.raises(HTTPException) as exc:
        _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert exc.value.status_code == 400
    assert "grande" in exc.value.detail.lower()


def test_upload_foto_bytes_invalidos_retorna_400():
    """Conteúdo que não é imagem decodificável vira 400, não 500."""
    f = _upload_file(b"isto nao e uma imagem", "image/png")
    db, _ = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert exc.value.status_code == 400


def test_upload_foto_decompression_bomb_retorna_400(monkeypatch):
    monkeypatch.setattr(storage.Image, "MAX_IMAGE_PIXELS", 1)
    f = _upload_file(_img_bytes((50, 50)), "image/png")
    db, _ = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert exc.value.status_code == 400
    assert "resolução" in exc.value.detail.lower()


# ── upload_foto: caminho feliz ────────────────────────────────────────────────

def test_upload_foto_imovel_aplica_marca_e_sobe_jpeg():
    f = _upload_file(_img_bytes(), "image/png")
    db, bucket = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        url = _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert url == bucket.get_public_url.return_value
    # Subiu como JPEG, independentemente do PNG de entrada.
    _, kwargs = bucket.upload.call_args
    assert kwargs["file_options"]["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(kwargs["file"])).format == "JPEG"


def test_upload_foto_perfil_nao_aplica_marca():
    """Fotos fora de imoveis/ (ex.: perfil) não recebem marca d'água."""
    f = _upload_file(_img_bytes(), "image/jpeg")
    db, bucket = _storage_mock()
    with patch.object(storage, "supabase_admin", db), \
         patch.object(storage, "_aplicar_marca_dagua") as marca:
        _run(storage.upload_foto(f, "perfil/user.jpg"))
    marca.assert_not_called()


def test_upload_foto_falha_no_storage_retorna_500():
    f = _upload_file(_img_bytes(), "image/png")
    db, bucket = _storage_mock()
    bucket.upload.side_effect = Exception("storage fora do ar")
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            _run(storage.upload_foto(f, "imoveis/1/foto.jpg"))
    assert exc.value.status_code == 500


# ── _para_jpeg / marca d'água ─────────────────────────────────────────────────

def test_para_jpeg_converte_rgba_para_jpeg():
    saida = storage._para_jpeg(_img_bytes(mode="RGBA"))
    assert Image.open(io.BytesIO(saida)).format == "JPEG"


def test_aplicar_marca_dagua_preserva_dimensoes_e_modo():
    base = Image.new("RGB", (400, 300), "white")
    out = storage._aplicar_marca_dagua(base)
    assert out.size == (400, 300)
    assert out.mode == "RGB"


# ── baixar_e_rotacionar ───────────────────────────────────────────────────────

def test_baixar_e_rotacionar_graus_invalidos_retorna_400():
    with pytest.raises(HTTPException) as exc:
        storage.baixar_e_rotacionar("https://x/object/public/media/a.jpg", 45)
    assert exc.value.status_code == 400


def test_baixar_e_rotacionar_gira_e_reencoda():
    db, bucket = _storage_mock()
    bucket.download.return_value = _img_bytes((20, 10))
    with patch.object(storage, "supabase_admin", db):
        out = storage.baixar_e_rotacionar(
            "https://x/storage/v1/object/public/media/imoveis/1/a.jpg", 90
        )
    img = Image.open(io.BytesIO(out))
    assert img.format == "JPEG"
    # 90° troca largura/altura (20x10 -> 10x20, antes da marca que mantém o tamanho).
    assert img.size == (10, 20)


def test_baixar_e_rotacionar_download_falha_retorna_500():
    db, bucket = _storage_mock()
    bucket.download.side_effect = Exception("404")
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            storage.baixar_e_rotacionar("https://x/object/public/media/a.jpg", 90)
    assert exc.value.status_code == 500


# ── upload_bytes_jpeg / upload_pdf_bytes / baixar_documento ───────────────────

def test_upload_bytes_jpeg_ok_e_falha():
    db, bucket = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        assert storage.upload_bytes_jpeg(b"jpg", "imoveis/1/a.jpg") == bucket.get_public_url.return_value
    bucket.upload.side_effect = Exception("x")
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            storage.upload_bytes_jpeg(b"jpg", "imoveis/1/a.jpg")
    assert exc.value.status_code == 500


def test_upload_pdf_bytes_retorna_path_e_usa_upsert():
    db, bucket = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        path = storage.upload_pdf_bytes(b"%PDF", "fichas-visita/1.pdf")
    assert path == "fichas-visita/1.pdf"
    _, kwargs = bucket.upload.call_args
    assert kwargs["file_options"]["upsert"] == "true"


def test_upload_pdf_bytes_falha_retorna_500():
    db, bucket = _storage_mock()
    bucket.upload.side_effect = Exception("x")
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            storage.upload_pdf_bytes(b"%PDF", "fichas-visita/1.pdf")
    assert exc.value.status_code == 500


def test_baixar_documento_ok_e_falha():
    db, bucket = _storage_mock()
    bucket.download.return_value = b"conteudo"
    with patch.object(storage, "supabase_admin", db):
        assert storage.baixar_documento("fichas-visita/1.pdf") == b"conteudo"
    bucket.download.side_effect = Exception("x")
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            storage.baixar_documento("fichas-visita/1.pdf")
    assert exc.value.status_code == 500


# ── deletar_foto ──────────────────────────────────────────────────────────────

def test_deletar_foto_extrai_bucket_e_path():
    db, bucket = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        _run(storage.deletar_foto("https://x/object/public/media/imoveis/1/a.jpg"))
    db.storage.from_.assert_called_with("media")
    bucket.remove.assert_called_once_with(["imoveis/1/a.jpg"])


def test_deletar_foto_url_malformada_nao_propaga():
    """deletar_foto é best-effort: erro só loga, nunca quebra o fluxo do chamador."""
    db, _ = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        _run(storage.deletar_foto("url-sem-padrao-esperado"))  # não levanta


# ── _bucket_e_path_da_url ─────────────────────────────────────────────────────

def test_bucket_e_path_da_url():
    bucket, path = storage._bucket_e_path_da_url(
        "https://x/storage/v1/object/public/media/imoveis/1/a.jpg"
    )
    assert bucket == "media"
    assert path == "imoveis/1/a.jpg"


# ── upload_documento ──────────────────────────────────────────────────────────

def test_upload_documento_rejeita_tipo_invalido():
    f = _upload_file(b"x", "image/gif", "a.gif")
    with pytest.raises(HTTPException) as exc:
        _run(storage.upload_documento(f, "locacoes/1/a.gif"))
    assert exc.value.status_code == 400


def test_upload_documento_rejeita_vazio_e_grande():
    db, _ = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            _run(storage.upload_documento(_upload_file(b"", "application/pdf"), "p"))
        assert exc.value.status_code == 400
        grande = b"0" * (storage.DOCUMENT_MAX_BYTES + 1)
        with pytest.raises(HTTPException) as exc2:
            _run(storage.upload_documento(_upload_file(grande, "application/pdf"), "p"))
        assert exc2.value.status_code == 400


def test_upload_documento_ok_retorna_metadados():
    f = _upload_file(b"%PDF-1.4 conteudo", "application/pdf", "contrato.pdf")
    db, _ = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        meta = _run(storage.upload_documento(f, "locacoes/1/contrato.pdf"))
    assert meta["firebase_path"] == "locacoes/1/contrato.pdf"
    assert meta["mime_type"] == "application/pdf"
    assert meta["tamanho_bytes"] == len(b"%PDF-1.4 conteudo")


def test_upload_documento_falha_storage_retorna_500():
    f = _upload_file(b"%PDF", "application/pdf")
    db, bucket = _storage_mock()
    bucket.upload.side_effect = Exception("x")
    with patch.object(storage, "supabase_admin", db):
        with pytest.raises(HTTPException) as exc:
            _run(storage.upload_documento(f, "locacoes/1/contrato.pdf"))
    assert exc.value.status_code == 500


# ── url_publica_documento (signed URL) ────────────────────────────────────────

@pytest.mark.parametrize("chave", ["signedURL", "signed_url", "signedUrl"])
def test_url_publica_documento_cobre_variantes_de_chave(chave):
    db, bucket = _storage_mock()
    bucket.create_signed_url.return_value = {chave: "https://signed/url"}
    with patch.object(storage, "supabase_admin", db):
        assert storage.url_publica_documento("locacoes/1/a.pdf") == "https://signed/url"


def test_url_publica_documento_fallback_quando_assinatura_falha():
    db, bucket = _storage_mock()
    bucket.create_signed_url.side_effect = Exception("sem permissão")
    with patch.object(storage, "supabase_admin", db):
        url = storage.url_publica_documento("locacoes/1/a.pdf")
    assert url == bucket.get_public_url.return_value


# ── deletar_documento ─────────────────────────────────────────────────────────

def test_deletar_documento_ok_e_erro_nao_propaga():
    db, bucket = _storage_mock()
    with patch.object(storage, "supabase_admin", db):
        storage.deletar_documento("locacoes/1/a.pdf")
    bucket.remove.assert_called_once_with(["locacoes/1/a.pdf"])
    bucket.remove.side_effect = Exception("x")
    with patch.object(storage, "supabase_admin", db):
        storage.deletar_documento("locacoes/1/a.pdf")  # não levanta
