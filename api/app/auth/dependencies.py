import logging
import secrets
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import supabase_admin
from app.services.audit_log import registrar_audit_acao

# Perfis com permissão de alteração. corretor foi equiparado a admin;
# a distinção de quem alterou fica registrada em acao_audit_log.
PERFIS_ESCRITA = ("admin", "corretor")

logger = logging.getLogger(__name__)
security = HTTPBearer()
# Variante que não estoura quando falta o header Authorization — usada onde a
# autenticação pode vir por um caminho alternativo (token de integração).
security_opcional = HTTPBearer(auto_error=False)

# Identidade sintética para chamadas server-to-server autenticadas pelo token
# de integração (não há usuário humano; serve para deixar rastro no audit log).
USUARIO_INTEGRACAO = {
    "id": None,
    "email": "integracao@morabilidade",
    "perfil": "integracao",
    "nome_completo": "Integração (server-to-server)",
}


def _usuario_do_token(token: str) -> dict:
    """Valida o JWT via Supabase Auth e retorna o usuário da tabela usuarios."""
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

    result = (
        supabase_admin.table("usuarios")
        .select("*")
        .eq("id", supabase_user.id)
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


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Valida o JWT via Supabase Auth (suporta ES256 e HS256)
    e retorna os dados do usuário da tabela usuarios.
    """
    return _usuario_do_token(credentials.credentials)


def _token_integracao_valido(request: Request) -> bool:
    """True se o header X-Internal-Token bate com o segredo configurado."""
    enviado = request.headers.get("X-Internal-Token")
    return bool(
        settings.internal_api_token
        and enviado
        and secrets.compare_digest(enviado, settings.internal_api_token)
    )


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


def require_admin_or_internal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_opcional),
) -> dict:
    """Permite escrita por (a) usuário admin/corretor logado OU (b) chamada
    server-to-server com o token de integração (header X-Internal-Token).

    Mantém a trava de perfil para o tráfego normal do painel; o atalho de
    integração não exige perfil nem que o operador exista em `usuarios`.
    """
    if _token_integracao_valido(request):
        registrar_audit_acao(
            user=USUARIO_INTEGRACAO,
            metodo=request.method,
            path=request.url.path,
        )
        return USUARIO_INTEGRACAO

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado.",
        )

    current_user = _usuario_do_token(credentials.credentials)
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
