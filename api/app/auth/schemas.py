from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    # URL completa (https://.../redefinir-senha) para onde o link do e-mail deve apontar.
    # Precisa estar listada em "Redirect URLs" no Supabase Dashboard.
    redirect_to: Optional[str] = None
