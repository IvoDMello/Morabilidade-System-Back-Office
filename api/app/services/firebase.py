import firebase_admin
from firebase_admin import credentials, storage
from fastapi import UploadFile, HTTPException
from app.config import settings
import uuid
from PIL import Image
import io

# Inicializa o Firebase Admin SDK (executado uma única vez)
if not firebase_admin._apps:
    cred = credentials.Certificate(settings.firebase_credentials_path)
    firebase_admin.initialize_app(cred, {"storageBucket": settings.firebase_storage_bucket})


MAX_SIZE_BYTES = 1_500_000  # 1.5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


async def upload_foto(file: UploadFile, path: str) -> str:
    """
    Faz upload de uma imagem para o Firebase Storage.
    Comprime automaticamente se necessário.
    Retorna a URL pública.
    """
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não permitido: {file.content_type}. Use JPEG, PNG ou WebP.",
        )

    contents = await file.read()

    # Comprime se maior que o limite
    if len(contents) > MAX_SIZE_BYTES:
        contents = _comprimir_imagem(contents)

    bucket = storage.bucket()
    blob = bucket.blob(path)
    blob.upload_from_string(contents, content_type="image/jpeg")
    blob.make_public()

    return blob.public_url


async def deletar_foto(url: str) -> None:
    """Remove uma imagem do Firebase Storage pela URL pública."""
    try:
        bucket = storage.bucket()
        # Extrai o path do blob a partir da URL pública
        path = url.split(f"/{settings.firebase_storage_bucket}/")[1].split("?")[0]
        blob = bucket.blob(path)
        blob.delete()
    except Exception:
        pass  # Não falha se a foto já foi removida


def _comprimir_imagem(contents: bytes, qualidade: int = 80) -> bytes:
    """Comprime uma imagem JPEG para reduzir o tamanho."""
    img = Image.open(io.BytesIO(contents))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=qualidade, optimize=True)
    return output.getvalue()
