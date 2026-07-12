from fastapi import Request
from slowapi import Limiter


def ip_real_do_cliente(request: Request) -> str:
    """Chave do rate limit: IP real do cliente atrás do proxy do Railway.

    ``get_remote_address`` veria só o IP do load balancer (o uvicorn roda sem
    --proxy-headers), colocando todos os visitantes num único balde — o limite
    ou bloqueia usuários legítimos ou não distingue um atacante. Reusa a
    extração resistente a spoof do X-Forwarded-For dos fluxos de assinatura.
    """
    from app.services.assinatura import ip_do_request

    return ip_do_request(request) or "unknown"


limiter = Limiter(key_func=ip_real_do_cliente)
