import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.limiter import limiter
from app.auth.schemas import LoginRequest, LoginResponse, ForgotPasswordRequest
from app.auth.dependencies import get_current_user
from app.database import supabase, supabase_admin
from app.services.email import enviar_recuperacao_senha

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest):
    """Autentica um usuário interno via e-mail e senha."""
    logger.info("[login] tentativa para email=%s", body.email)
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
        logger.warning("[login] Supabase respondeu sem session para email=%s", body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falha na autenticação.",
        )

    logger.info("[login] sucesso para email=%s", body.email)
    return LoginResponse(
        access_token=session.access_token,
        user={"id": response.user.id, "email": response.user.email},
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: dict = Depends(get_current_user)):
    """Invalida todas as sessões do usuário no Supabase Auth."""
    try:
        supabase_admin.auth.admin.sign_out(current_user["id"])
    except Exception:
        pass


@router.post("/recuperar-senha", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Gera link de recuperação via Supabase Admin e envia e-mail branded via Resend."""
    logger.info(
        "[recuperar-senha] solicitação recebida para email=%s, redirect_to=%s",
        body.email,
        body.redirect_to,
    )
    try:
        params: dict = {"type": "recovery", "email": body.email}
        if body.redirect_to:
            params["options"] = {"redirect_to": body.redirect_to}

        response = supabase_admin.auth.admin.generate_link(params)
        action_link = response.properties.action_link
        logger.info("[recuperar-senha] link gerado com sucesso para email=%s", body.email)
    except Exception:
        # Não revela ao cliente se o e-mail existe ou não.
        logger.exception("[recuperar-senha] falha ao gerar link no Supabase Admin")
        return

    try:
        enviar_recuperacao_senha(body.email, action_link)
        logger.info("[recuperar-senha] e-mail enviado via Resend para email=%s", body.email)
    except Exception:
        logger.exception("[recuperar-senha] falha ao enviar e-mail via Resend")
