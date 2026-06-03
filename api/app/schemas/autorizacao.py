"""Schemas da Autorização de Intermediação Imobiliária.

Documento assinado pelo proprietário que autoriza a Morabilidade a intermediar
a venda/locação do imóvel e fixa a comissão (arts. 722-729 CC). Ver router
`autorizacoes` e serviço `autorizacao_pdf`.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_serializer


class AutorizacaoCreate(BaseModel):
    imovel_id: str
    # Proprietário: se omitido, puxa do proprietario_id do imóvel.
    proprietario_id: Optional[str] = None
    proprietario_nome: Optional[str] = Field(None, max_length=200)
    proprietario_cpf: Optional[str] = Field(None, max_length=20)
    proprietario_telefone: Optional[str] = Field(None, max_length=40)
    proprietario_email: Optional[str] = Field(None, max_length=200)
    proprietario_endereco: Optional[str] = Field(None, max_length=300)

    tipo_negocio: str = Field("venda", pattern="^(venda|locacao|ambos)$")
    valor_autorizado: Optional[Decimal] = None
    exclusiva: bool = True
    comissao_venda_pct: Optional[Decimal] = Field(Decimal("6"), ge=0, le=100)
    comissao_locacao_desc: Optional[str] = Field("equivalente ao primeiro aluguel", max_length=200)
    prazo_dias: int = Field(90, ge=1, le=730)

    corretor_id: Optional[str] = None


class AutorizacaoOut(BaseModel):
    id: str
    imovel_id: str
    proprietario_id: Optional[str] = None
    corretor_id: Optional[str] = None

    proprietario_nome: str
    proprietario_cpf: Optional[str] = None
    proprietario_telefone: Optional[str] = None
    proprietario_email: Optional[str] = None

    imovel_codigo: Optional[str] = None
    imovel_endereco: Optional[str] = None
    imovel_bairro: Optional[str] = None
    imovel_cidade: Optional[str] = None

    tipo_negocio: str
    valor_autorizado: Optional[Decimal] = None
    exclusiva: bool
    comissao_venda_pct: Optional[Decimal] = None
    comissao_locacao_desc: Optional[str] = None
    prazo_dias: int
    corretor_nome: Optional[str] = None
    corretor_creci: Optional[str] = None

    status: str
    token: str
    token_expira_em: Optional[str] = None
    assinada_em: Optional[str] = None
    documento_hash: Optional[str] = None
    created_at: str

    @field_serializer("valor_autorizado", "comissao_venda_pct")
    def _ser_dec(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class AutorizacaoPublicaView(BaseModel):
    """O que o proprietário vê na página de assinatura."""
    status: str
    proprietario_nome: str
    imovel_codigo: Optional[str] = None
    imovel_endereco: Optional[str] = None
    imovel_bairro: Optional[str] = None
    imovel_cidade: Optional[str] = None
    tipo_negocio: str
    valor_autorizado: Optional[Decimal] = None
    exclusiva: bool
    comissao_venda_pct: Optional[Decimal] = None
    comissao_locacao_desc: Optional[str] = None
    prazo_dias: int
    corretor_nome: Optional[str] = None
    corretor_creci: Optional[str] = None
    clausula_texto: str

    @field_serializer("valor_autorizado", "comissao_venda_pct")
    def _ser_dec(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class AutorizacaoAssinaturaIn(BaseModel):
    aceite: bool
    cpf: str = Field(..., min_length=11, max_length=20)
    assinatura_png: Optional[str] = Field(None, max_length=2_000_000)
    geo: Optional[str] = Field(None, max_length=120)
