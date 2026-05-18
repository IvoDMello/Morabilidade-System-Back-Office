import io
import logging

from fastapi import UploadFile, HTTPException
from app.database import supabase_admin
from PIL import Image

logger = logging.getLogger(__name__)

BUCKET = "media"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTO_MAX_BYTES = 10 * 1024 * 1024  # 10 MB — fotos de imóvel e perfil

# Bloqueia "decompression bombs" — uma PNG de 10 KB pode descompactar para
# centenas de MB de pixels e estourar a RAM do worker. 50 megapixels cobre até
# fotos profissionais de imóvel (8K) com folga.
Image.MAX_IMAGE_PIXELS = 50_000_000


async def upload_foto(file: UploadFile, path: str) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo não permitido: {file.content_type}. Use JPEG, PNG ou WebP.",
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(status_code=400, detail="Arquivo vazio recebido.")

    if len(contents) > PHOTO_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Imagem muito grande (máx {PHOTO_MAX_BYTES // (1024 * 1024)} MB).",
        )

    try:
        contents = _para_jpeg(contents)
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=400,
            detail="Imagem com resolução muito alta — reduza antes de enviar.",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Não foi possível processar a imagem: {e}")

    try:
        supabase_admin.storage.from_(BUCKET).upload(
            path=path,
            file=contents,
            file_options={"content-type": "image/jpeg", "upsert": "false"},
        )
        return supabase_admin.storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha no upload: {e}")


async def deletar_foto(url: str) -> None:
    try:
        # Extrai bucket e path da URL pública do Supabase
        # Formato: .../storage/v1/object/public/{bucket}/{path}
        parte = url.split("/object/public/")[1]
        bucket, path = parte.split("/", 1)
        supabase_admin.storage.from_(bucket).remove([path])
    except Exception as e:
        logger.warning("Falha ao deletar foto do storage: url=%s erro=%s", url, e)


def _para_jpeg(contents: bytes, qualidade: int = 85) -> bytes:
    img = Image.open(io.BytesIO(contents))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=qualidade, optimize=True)
    return out.getvalue()


# ── Documentos (contratos PDF / aditivos / vistorias) ────────────────────────

DOCUMENT_TYPES = {
    "application/pdf",
    "image/jpeg", "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024  # 10 MB — suficiente para contratos scan


async def upload_documento(file: UploadFile, path: str) -> dict:
    """Upload genérico de documento (sem conversão como em upload_foto).
    Retorna {firebase_path, mime_type, tamanho_bytes} para persistir no banco.

    'firebase_path' mantém o nome legado da coluna em locacao_anexos — o
    bucket é o mesmo Supabase Storage usado pelas fotos.
    """
    if file.content_type not in DOCUMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tipo não permitido: {file.content_type}. "
                "Aceitamos PDF, JPG, PNG, DOC ou DOCX."
            ),
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Arquivo vazio recebido.")
    if len(contents) > DOCUMENT_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Arquivo muito grande (máx {DOCUMENT_MAX_BYTES // (1024 * 1024)} MB).",
        )

    try:
        supabase_admin.storage.from_(BUCKET).upload(
            path=path,
            file=contents,
            file_options={"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha no upload: {e}")

    return {
        "firebase_path": path,
        "mime_type": file.content_type,
        "tamanho_bytes": len(contents),
    }


DOCUMENT_SIGNED_URL_TTL = 300  # 5 min — janela para o browser baixar o arquivo


def url_publica_documento(path: str) -> str:
    """Gera uma signed URL de curta duração (5 min) para download do documento.

    O bucket é tecnicamente público, mas anexos de contrato contêm CPF, valores
    e dados sensíveis. URLs assinadas evitam que um link vazado por log/e-mail
    encaminhado permaneça válido indefinidamente.
    """
    try:
        signed = supabase_admin.storage.from_(BUCKET).create_signed_url(
            path, DOCUMENT_SIGNED_URL_TTL
        )
    except Exception:
        logger.warning("Falha ao assinar URL — caindo no get_public_url (path=%s)", path)
        return supabase_admin.storage.from_(BUCKET).get_public_url(path)

    # O SDK do supabase-py retorna ora {"signedURL": "..."} (snake_case adapter),
    # ora {"signed_url": "..."}; cobrimos os dois.
    if isinstance(signed, dict):
        return signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl") or ""
    return signed or ""


def deletar_documento(path: str) -> None:
    try:
        supabase_admin.storage.from_(BUCKET).remove([path])
    except Exception as e:
        logger.warning("Falha ao deletar documento do storage: path=%s erro=%s", path, e)
