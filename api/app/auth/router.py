from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.limiter import limiter
from app.auth.schemas import LoginRequest, LoginResponse, ForgotPasswordRequest
from app.auth.dependencies import get_current_user
from app.database import supabase, supabase_admin

router = APIRouter()


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
def logout(current_user: dict = Depends(get_current_user)):
    """Invalida todas as sessões do usuário no Supabase Auth."""
    try:
        supabase_admin.auth.admin.sign_out(current_user["id"])
    except Exception:
        pass


@router.post("/recuperar-senha", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Envia e-mail de recuperação de senha via Supabase Auth."""
    try:
        supabase.auth.reset_password_email(body.email)
    except Exception:
        # Não revela se o e-mail existe ou não
        pass
