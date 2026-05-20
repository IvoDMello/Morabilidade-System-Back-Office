import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from app.limiter import limiter
from app.auth.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
)
from app.auth.dependencies import get_current_user
from app.database import supabase, supabase_admin
from app.services.email import enviar_recuperacao_senha

logger = logging.getLogger(__name__)
router = APIRouter()


def _mask_email(email: str) -> str:
    """Mascara para log: usuario@dominio.com -> u***@dominio.com.
    Evita salvar PII bruta nos logs (LGPD) sem perder rastreabilidade."""
    if not email or "@" not in email:
        return "***"
    local, _, dominio = email.partition("@")
    if len(local) <= 1:
        return f"*@{dominio}"
    return f"{local[0]}***@{dominio}"


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest):
    """Autentica um usuário interno via e-mail e senha."""
    logger.info("[login] tentativa para email=%s", _mask_email(body.email))
    try:
        response = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.senha}
        )
    except Exception:
        logger.exception("[login] Supabase rejeitou as credenciais")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )

    session = response.session
    if not session:
        logger.warning("[login] Supabase respondeu sem session para email=%s", _mask_email(body.email))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falha na autenticação.",
        )

    logger.info("[login] sucesso para email=%s", _mask_email(body.email))
    return LoginResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=getattr(session, "expires_in", 3600) or 3600,
        user={"id": response.user.id, "email": response.user.email},
    )


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("30/minute")
def refresh(request: Request, body: RefreshRequest):
    """Troca um refresh_token por um novo par (access + refresh).

    O Supabase rotaciona o refresh_token a cada uso: o antigo é invalidado
    assim que o novo é emitido — token roubado fica inservível depois do
    primeiro uso legítimo.
    """
    try:
        response = supabase.auth.refresh_session(body.refresh_token)
    except Exception:
        logger.warning("[refresh] refresh_token inválido ou expirado")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )

    session = response.session
    if not session or not session.access_token or not session.refresh_token:
        logger.warning("[refresh] Supabase respondeu sem session válida")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )

    return RefreshResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=getattr(session, "expires_in", 3600) or 3600,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: dict = Depends(get_current_user)):
    """Invalida todas as sessões do usuário no Supabase Auth."""
    try:
        supabase_admin.auth.admin.sign_out(current_user["id"])
    except Exception:
        pass


def _processar_recuperacao_senha(email: str, redirect_to: str | None) -> None:
    """Roda em background — gera o link via Supabase Admin e envia via Resend.

    Falhas (e-mail inexistente, Supabase fora do ar, Resend fora do ar) são só
    logadas. O cliente sempre recebe 204, sem oracle de enumeração de e-mail.
    """
    masked = _mask_email(email)
    try:
        params: dict = {"type": "recovery", "email": email}
        if redirect_to:
            params["options"] = {"redirect_to": redirect_to}

        response = supabase_admin.auth.admin.generate_link(params)
        action_link = response.properties.action_link
    except Exception:
        logger.exception("[recuperar-senha] falha ao gerar link (email=%s)", masked)
        return

    try:
        enviar_recuperacao_senha(email, action_link)
        logger.info("[recuperar-senha] e-mail enviado (email=%s)", masked)
    except Exception:
        logger.exception("[recuperar-senha] falha ao enviar e-mail (email=%s)", masked)


@router.post("/recuperar-senha", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
):
    """Sempre retorna 204 — o trabalho real roda em background para não revelar
    se o e-mail existe (evita enumeração via timing/status code)."""
    logger.info("[recuperar-senha] solicitação recebida (email=%s)", _mask_email(body.email))
    background_tasks.add_task(_processar_recuperacao_senha, body.email, body.redirect_to)
