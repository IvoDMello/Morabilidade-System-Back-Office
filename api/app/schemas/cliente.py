from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class StatusCliente(str, Enum):
    ativo = "ativo"
    em_negociacao = "em_negociacao"
    inativo = "inativo"
    concluido = "concluido"


class TipoCliente(str, Enum):
    comprador = "comprador"
    locatario = "locatario"
    proprietario = "proprietario"
    investidor = "investidor"


class OrigemLead(str, Enum):
    site = "site"
    indicacao = "indicacao"
    ligacao = "ligacao"
    whatsapp = "whatsapp"
    instagram = "instagram"
    facebook = "facebook"
    outro = "outro"


class ClienteCreate(BaseModel):
    nome_completo: str
    email: Optional[EmailStr] = None
    telefone: str
    cpf_cnpj: Optional[str] = None
    data_nascimento: Optional[str] = None
    telefone_secundario: Optional[str] = None
    instagram: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    pais: Optional[str] = None
    profissao_empresa: Optional[str] = None
    origem_lead: Optional[OrigemLead] = None
    corretor_id: Optional[str] = None
    status: Optional[StatusCliente] = None
    tipo_cliente: Optional[TipoCliente] = None
    renda_aproximada: Optional[float] = None
    como_conheceu: Optional[str] = None
    observacoes: Optional[str] = None
    imovel_codigo: Optional[str] = None


class ClienteUpdate(ClienteCreate):
    nome_completo: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None


class ClienteOut(ClienteCreate):
    id: str
    created_at: str
    updated_at: str


class ClienteListOut(BaseModel):
    id: str
    nome_completo: str
    email: Optional[str] = None
    telefone: str
    status: Optional[StatusCliente] = None
    tipo_cliente: Optional[TipoCliente] = None
    origem_lead: Optional[OrigemLead] = None
    imovel_codigo: Optional[str] = None
    observacoes: Optional[str] = None
    created_at: str
