import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import supabase_admin

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


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Exige que o usuário seja administrador."""
    if current_user.get("perfil") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores.",
        )
    return current_user
