"""Helpers compartilhados pelos fluxos de assinatura eletrônica (ficha de visita
e autorização de intermediação).

Centraliza a captura da origem do signatário (IP real + cadeia de proxy), o
formato de endereço do imóvel, a emissão/expiração de tokens, a primitiva de
hash do documento e a montagem da resposta PDF, antes duplicados nos dois routers.
"""
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request, Response

from app.config import settings

# Limite do XFF cru gravado como forense, protege contra header gigante.
_XFF_MAX_LEN = 500

# Validade do link de assinatura (ficha de visita e autorização).
TOKEN_VALIDADE_DIAS = 7


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


# ── Token de assinatura ───────────────────────────────────────────────────────

def gerar_token() -> str:
    """Token de assinatura opaco e imprevisível para a URL pública."""
    return secrets.token_urlsafe(32)


def expira_em(agora: datetime, dias: int = TOKEN_VALIDADE_DIAS) -> str:
    """ISO 8601 do vencimento do link (`agora` + `dias`)."""
    return (agora + timedelta(days=dias)).isoformat()


def token_expirado(expira_em_iso: Optional[str], agora: Optional[datetime] = None) -> bool:
    """True se o link de assinatura já venceu. Sem data ou data inválida → False
    (não bloqueia: o registro segue válido até alguém setar uma data correta)."""
    if not expira_em_iso:
        return False
    agora = agora or datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(str(expira_em_iso).replace("Z", "+00:00")) < agora
    except ValueError:
        return False


# ── Hash e resposta PDF ───────────────────────────────────────────────────────

def sha256_canonico(nucleo: dict) -> str:
    """SHA-256 da serialização canônica (chaves ordenadas) do núcleo assinado.
    Calcula sobre os dados, não sobre o PDF (que tem timestamps não determinísticos)."""
    canonico = json.dumps(nucleo, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonico.encode("utf-8")).hexdigest()


def pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    """Resposta de download de PDF com Content-Disposition exposto ao browser."""
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
