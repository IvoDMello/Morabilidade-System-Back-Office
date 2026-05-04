from pydantic import BaseModel, EmailStr, model_validator
from typing import List, Optional
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
    telefone: Optional[str] = None
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
    tag_ids: Optional[List[str]] = None

    @model_validator(mode="after")
    def requer_telefone_ou_instagram(self) -> "ClienteCreate":
        tel = (self.telefone or "").strip()
        ig = (self.instagram or "").strip()
        if not tel and not ig:
            raise ValueError("Informe ao menos o telefone ou o Instagram.")
        self.telefone = tel or None
        self.instagram = ig or None
        return self


class ClienteUpdate(ClienteCreate):
    nome_completo: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None

    @model_validator(mode="after")
    def requer_telefone_ou_instagram(self) -> "ClienteUpdate":
        # Atualizações parciais não exigem que ambos os campos estejam presentes.
        tel = (self.telefone or "").strip()
        ig = (self.instagram or "").strip()
        self.telefone = tel or None
        self.instagram = ig or None
        return self


class TagSimples(BaseModel):
    id: str
    nome: str
    cor: Optional[str] = None


class ClienteOut(ClienteCreate):
    id: str
    created_at: str
    updated_at: str
    tags: List[TagSimples] = []


class ClienteListOut(BaseModel):
    id: str
    nome_completo: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    status: Optional[StatusCliente] = None
    tipo_cliente: Optional[TipoCliente] = None
    origem_lead: Optional[OrigemLead] = None
    imovel_codigo: Optional[str] = None
    observacoes: Optional[str] = None
    tags: List[TagSimples] = []
    created_at: str
