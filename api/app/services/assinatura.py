"""Helpers compartilhados pelos fluxos de assinatura eletrônica (ficha de visita
e autorização de intermediação).

Centraliza a captura da origem do signatário (IP real + cadeia de proxy) e o
formato de endereço do imóvel — antes duplicados nos dois routers.
"""
from typing import Optional

from fastapi import Request

from app.config import settings

# Limite do XFF cru gravado como forense — protege contra header gigante.
_XFF_MAX_LEN = 500


def ip_do_request(request: Request, trusted_hops: Optional[int] = None) -> Optional[str]:
    """IP real do cliente, resistente a spoof do ``X-Forwarded-For``.

    Cada proxy confiável ACRESCENTA ao XFF o IP de quem se conectou a ele, então
    com ``N`` proxies confiáveis o IP do cliente fica em ``xff[-N]``. Entradas à
    esquerda podem ter sido forjadas pelo cliente (que controla o header inicial),
    por isso nunca pegamos ``xff[0]``.

    No Railway ``N = 2`` (settings.trusted_proxy_hops). Atrás de um proxy local
    sem XFF, cai no ``request.client.host``.
    """
    hops = settings.trusted_proxy_hops if trusted_hops is None else trusted_hops
    hops = max(1, hops)

    xff = request.headers.get("x-forwarded-for")
    if xff:
        partes = [p.strip() for p in xff.split(",") if p.strip()]
        if len(partes) >= hops:
            return partes[-hops]
        if partes:
            # Cadeia mais curta que o esperado (menos proxies acrescentaram):
            # a entrada mais à esquerda é a de quem se conectou primeiro.
            return partes[0]

    return request.client.host if request.client else None


def xff_bruto(request: Request) -> Optional[str]:
    """Cadeia ``X-Forwarded-For`` crua, para a trilha de auditoria (forense).

    Guardar a cadeia inteira permite re-derivar o IP do cliente se a topologia de
    proxy mudar no futuro (ex.: entrar um CDN), sem perder a prova já registrada.
    """
    xff = request.headers.get("x-forwarded-for")
    if not xff:
        return None
    return xff[:_XFF_MAX_LEN]


def montar_endereco(imovel: dict) -> str:
    """Logradouro, número e complemento em uma linha (ignora campos vazios)."""
    partes = [imovel.get("logradouro")]
    if imovel.get("numero"):
        partes.append(str(imovel["numero"]))
    if imovel.get("complemento"):
        partes.append(str(imovel["complemento"]))
    return ", ".join(p for p in partes if p)
