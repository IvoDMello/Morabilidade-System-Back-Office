from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum


class PerfilAcesso(str, Enum):
    admin = "admin"        # acesso total (escrita + leitura)
    # Acesso reduzido: lê todas as entidades e cria itens operacionais
    # (visitas e notas de cliente), mas NÃO cria/altera imóveis, clientes,
    # contratos, pagamentos, tags ou outros usuários. Quem aplica essa
    # restrição é a dependency `require_admin` nos routers.
    corretor = "corretor"


class UserCreate(BaseModel):
    nome_completo: str
    email: EmailStr
    senha: str = Field(..., min_length=8)
    perfil: PerfilAcesso
    telefone: Optional[str] = None


class UserUpdate(BaseModel):
    nome_completo: Optional[str] = None
    telefone: Optional[str] = None
    foto_url: Optional[str] = None
    creci: Optional[str] = None
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
    creci: Optional[str] = None
    ativo: bool
    created_at: str
    updated_at: str
