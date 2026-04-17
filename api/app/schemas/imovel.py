from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from decimal import Decimal


class TipoNegocio(str, Enum):
    venda = "venda"
    locacao = "locacao"
    ambos = "ambos"


class Disponibilidade(str, Enum):
    disponivel = "disponivel"
    reservado = "reservado"
    vendido_locado = "vendido_locado"


class TipoImovel(str, Enum):
    casa = "casa"
    apartamento = "apartamento"
    terreno = "terreno"
    sala = "sala"
    galpao = "galpao"
    loja = "loja"
    cobertura = "cobertura"
    kitnet = "kitnet"
    outro = "outro"


class Mobiliado(str, Enum):
    sim = "sim"
    nao = "nao"
    semi = "semi-mobiliado"


class CondicaoImovel(str, Enum):
    em_construcao = "em_construcao"
    na_planta = "na_planta"
    novo = "novo"
    usado = "usado"


class ImovelCreate(BaseModel):
    codigo: Optional[str] = None  # gerado automaticamente se None
    tipo_negocio: TipoNegocio
    disponibilidade: Disponibilidade = Disponibilidade.disponivel
    cidade: str
    bairro: str
    logradouro: str
    numero: Optional[str] = None
    complemento: Optional[str] = None
    cep: Optional[str] = None
    tipo_imovel: TipoImovel
    dormitorios: Optional[int] = None
    suites: Optional[int] = None
    banheiros: Optional[int] = None
    vagas_garagem: Optional[int] = None
    mobiliado: Optional[Mobiliado] = None
    condicao: CondicaoImovel
    andar: Optional[int] = None
    area_total: Optional[Decimal] = None
    area_util: Optional[Decimal] = None
    valor_venda: Optional[Decimal] = None
    valor_locacao: Optional[Decimal] = None
    iptu_mensal: Optional[Decimal] = None
    condominio_mensal: Optional[Decimal] = None
    descricao: Optional[str] = None
    video_url: Optional[str] = None
    corretor_id: Optional[str] = None
    tag_ids: Optional[List[str]] = []


class ImovelUpdate(ImovelCreate):
    tipo_negocio: Optional[TipoNegocio] = None
    disponibilidade: Optional[Disponibilidade] = None
    cidade: Optional[str] = None
    bairro: Optional[str] = None
    logradouro: Optional[str] = None
    tipo_imovel: Optional[TipoImovel] = None
    condicao: Optional[CondicaoImovel] = None


class FotoOut(BaseModel):
    id: str
    url: str
    ordem: int


class ImovelOut(ImovelCreate):
    id: str
    codigo: str
    fotos: List[FotoOut] = []
    tags: List[dict] = []
    created_at: str
    updated_at: str


class ImovelListOut(BaseModel):
    id: str
    codigo: str
    tipo_negocio: TipoNegocio
    disponibilidade: Disponibilidade
    cidade: str
    bairro: str
    tipo_imovel: TipoImovel
    dormitorios: Optional[int] = None
    area_util: Optional[Decimal] = None
    valor_venda: Optional[Decimal] = None
    valor_locacao: Optional[Decimal] = None
    foto_capa: Optional[str] = None
    tags: List[dict] = []
    created_at: str


class ImovelFiltros(BaseModel):
    codigo: Optional[str] = None
    tipo_negocio: Optional[TipoNegocio] = None
    disponibilidade: Optional[Disponibilidade] = None
    cidade: Optional[str] = None
    bairro: Optional[str] = None
    tipo_imovel: Optional[TipoImovel] = None
    dormitorios_min: Optional[int] = None
    preco_min: Optional[Decimal] = None
    preco_max: Optional[Decimal] = None
    condicao: Optional[CondicaoImovel] = None
    mobiliado: Optional[Mobiliado] = None
    page: int = 1
    page_size: int = 20
