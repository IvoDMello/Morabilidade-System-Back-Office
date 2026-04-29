from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class PerfilAcesso(str, Enum):
    admin = "admin"      # acesso total (escrita + leitura)
    corretor = "corretor"  # somente leitura


class UserCreate(BaseModel):
    nome_completo: str
    email: EmailStr
    senha: str
    perfil: PerfilAcesso
    telefone: Optional[str] = None


class UserUpdate(BaseModel):
    nome_completo: Optional[str] = None
    telefone: Optional[str] = None
    foto_url: Optional[str] = None
    perfil: Optional[PerfilAcesso] = None
    ativo: Optional[bool] = None


class UserChangePassword(BaseModel):
    senha_atual: str
    nova_senha: str


class UserOut(BaseModel):
    id: str
    nome_completo: str
    email: str
    perfil: PerfilAcesso
    telefone: Optional[str] = None
    foto_url: Optional[str] = None
    ativo: bool
    created_at: str
    updated_at: str
