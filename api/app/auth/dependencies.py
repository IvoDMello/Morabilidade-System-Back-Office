import logging
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import supabase_admin
from app.services.audit_log import registrar_audit_acao

# Perfis com permissão de alteração. corretor foi equiparado a admin;
# a distinção de quem alterou fica registrada em acao_audit_log.
PERFIS_ESCRITA = ("admin", "corretor")

logger = logging.getLogger(__name__)
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Valida o JWT via Supabase Auth (suporta ES256 e HS256)
    e retorna os dados do usuário da tabela usuarios.
    """
    token = credentials.credentials

    try:
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
    except Exception:
        logger.exception("Falha ao validar token JWT via Supabase Auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )

    if not supabase_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    user_id = supabase_user.id

    result = (
        supabase_admin.table("usuarios")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )

    if not result.data.get("ativo", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada.",
        )

    return result.data


def require_admin(
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Exige perfil com permissão de escrita (admin ou corretor).

    O corretor tem as mesmas permissões de alteração do admin; a ação é
    registrada em acao_audit_log para rastrear quem alterou.
    """
    if current_user.get("perfil") not in PERFIS_ESCRITA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito.",
        )
    registrar_audit_acao(
        user=current_user,
        metodo=request.method,
        path=request.url.path,
    )
    return current_user
