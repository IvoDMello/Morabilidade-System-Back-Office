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
    ficha_visita = "ficha_visita"
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
    # Optional para tolerar leitura antes da migration 047 rodar.
    codigo: Optional[str] = None
    created_at: str
    updated_at: str
    tags: List[TagSimples] = []


class ClienteUpsertInterno(BaseModel):
    """Entrada do upsert server-to-server por telefone (CRM do WhatsApp).

    Deliberadamente menor que ClienteCreate: uma integração só deve mandar o que
    ela realmente sabe. Tudo que um atendente preencheria à mão (CPF, endereço,
    renda) fica de fora — não é papel do chat inventar esses campos.
    """
    telefone: str
    nome_completo: str
    origem_lead: Optional[OrigemLead] = OrigemLead.whatsapp
    tipo_cliente: Optional[TipoCliente] = None
    status: Optional[StatusCliente] = None
    observacoes: Optional[str] = None
    imovel_codigo: Optional[str] = None

    @model_validator(mode="after")
    def exige_telefone_util(self) -> "ClienteUpsertInterno":
        tel = (self.telefone or "").strip()
        # Menos de 10 dígitos (sem DDD) não casa com ninguém de forma confiável
        # e criaria um cliente impossível de reencontrar depois.
        if len([c for c in tel if c.isdigit()]) < 10:
            raise ValueError("Telefone inválido: informe DDD + número.")
        self.telefone = tel
        nome = (self.nome_completo or "").strip()
        if not nome:
            raise ValueError("Informe o nome do cliente.")
        self.nome_completo = nome
        return self


class ClienteUpsertOut(BaseModel):
    """Resultado do upsert. `criado` diz ao CRM se ele acabou de trazer alguém
    novo para a base ou se apenas reencontrou quem já existia — os dois casos
    são normais, mas só o primeiro é notícia."""
    id: str
    codigo: Optional[str] = None
    nome_completo: str
    telefone: Optional[str] = None
    criado: bool


class ClienteListOut(BaseModel):
    id: str
    codigo: Optional[str] = None
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
