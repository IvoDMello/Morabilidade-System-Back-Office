from fastapi import APIRouter, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.auth.schemas import LoginRequest, LoginResponse, ForgotPasswordRequest
from app.database import supabase

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest):
    """Autentica um usuário interno via e-mail e senha."""
    try:
        response = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.senha}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )

    session = response.session
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falha na autenticação.",
        )

    return LoginResponse(
        access_token=session.access_token,
        user={"id": response.user.id, "email": response.user.email},
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    """Invalida a sessão do usuário."""
    supabase.auth.sign_out()


@router.post("/recuperar-senha", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Envia e-mail de recuperação de senha via Supabase Auth."""
    try:
        supabase.auth.reset_password_email(body.email)
    except Exception:
        # Não revela se o e-mail existe ou não
        pass
