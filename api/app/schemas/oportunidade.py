"""
Schemas para o módulo de oportunidades (preferências e matches).

Match = imóvel disponível que casa com a preferência ativa de um cliente.
A geração é sob demanda (não há tabela de matches): consulta-se a tabela
de preferências e cruza-se com a de imóveis disponíveis.
"""
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.imovel import TipoNegocio


class TipoImovelPreferencia(str, Enum):
    """Tipos aceitos em cliente_preferencias.tipo_imovel.

    Inclui os mesmos valores de TipoImovel mais 'apartamento_terreo', que
    é uma variação de busca (apartamento no andar 1) introduzida pelo
    HeroSearch do site público e não existe como tipo real de imóvel.
    """
    casa = "casa"
    casa_vila = "casa_vila"
    casa_condominio = "casa_condominio"
    apartamento = "apartamento"
    apartamento_terreo = "apartamento_terreo"
    terreno = "terreno"
    sala = "sala"
    galpao = "galpao"
    loja = "loja"
    cobertura = "cobertura"
    kitnet = "kitnet"
    outro = "outro"

# Deve ser igual ao VALOR_MINIMO_OPORTUNIDADE em routers/oportunidades.py.
_VALOR_MIN_OPOR = 2_000_000.0


class PreferenciaBase(BaseModel):
    tipo_negocio: Optional[TipoNegocio] = None
    tipo_imovel: Optional[TipoImovelPreferencia] = None
    cidade: Optional[str] = None
    bairros: List[str] = []
    valor_min: Optional[float] = Field(default=None, ge=0)
    valor_max: Optional[float] = Field(default=None, ge=0)
    dormitorios_min: Optional[int] = Field(default=None, ge=0)
    vagas_garagem_min: Optional[int] = Field(default=None, ge=0)
    observacoes: Optional[str] = None
    ativa: bool = True

    @model_validator(mode="after")
    def valor_min_menor_que_max(self) -> "PreferenciaBase":
        if self.valor_min is not None and self.valor_max is not None:
            if self.valor_min > self.valor_max:
                raise ValueError("valor_min não pode ser maior que valor_max.")
        return self


class PreferenciaCreate(PreferenciaBase):
    pass


class PreferenciaUpdate(PreferenciaBase):
    pass


class PreferenciaOut(PreferenciaBase):
    id: str
    cliente_id: str
    # 'manual' = cadastrada pelo corretor; 'ficha_visita' = inferida das fichas
    # de visita assinadas (recalculada a cada assinatura até virar manual).
    origem: str = "manual"
    created_at: str
    updated_at: str


class MatchClienteImovel(BaseModel):
    """Imóvel que casa com a preferência de um cliente (visão do cliente)."""
    imovel_id: str
    codigo: str
    cidade: str
    bairro: str
    tipo_imovel: str
    tipo_negocio: str
    valor_venda: Optional[float] = None
    valor_locacao: Optional[float] = None
    dormitorios: Optional[int] = None
    vagas_garagem: Optional[int] = None
    foto_capa: Optional[str] = None
    score: int = 0


class MatchImovelCliente(BaseModel):
    """Cliente cuja preferência casa com um imóvel (visão do imóvel)."""
    cliente_id: str
    nome_completo: str
    telefone: Optional[str] = None
    email: Optional[str] = None
    tipo_cliente: Optional[str] = None
    preferencia_id: str
    observacoes_preferencia: Optional[str] = None
    score: int = 0


class MatchsList(BaseModel):
    """Resposta agregada — usada pelo dashboard."""
    total: int
    items: List[MatchImovelCliente]
