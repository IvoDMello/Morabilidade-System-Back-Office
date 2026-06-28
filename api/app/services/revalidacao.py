"""Revalidação on-demand do site público (Next.js ISR).

Ao criar/editar/excluir um imóvel, o back-office avisa o site para refazer o
cache da página afetada na hora — sem esperar o ISR expirar. É best-effort:
qualquer falha é registrada e engolida, nunca quebra a operação principal.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def revalidar_imovel(codigo: str | None = None) -> None:
    """Dispara POST {SITE_URL}/api/revalidate. Silencioso se mal configurado."""
    secret = settings.site_revalidate_secret
    if not secret or not settings.site_url:
        return  # integração desligada — sem segredo configurado

    url = settings.site_url.rstrip("/") + "/api/revalidate"
    try:
        httpx.post(
            url,
            headers={"x-revalidate-secret": secret},
            json={"codigo": codigo} if codigo else {},
            timeout=5.0,
        )
    except Exception as exc:  # rede/timeout/etc — não pode derrubar o save
        logger.warning("Falha ao revalidar site para %s: %s", codigo, exc)
