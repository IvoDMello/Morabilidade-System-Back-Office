"""Schemas da Autorização de Intermediação Imobiliária.

Documento assinado pelo(s) proprietário(s) que autoriza a Morabilidade a
intermediar a venda/locação do imóvel e fixa a comissão (arts. 722-729 CC).
Suporta múltiplos signatários, cada proprietário recebe o próprio link e a
autorização só fica 'assinada' quando todos assinarem (migration 038). Ver
router `autorizacoes` e serviço `autorizacao_pdf`.
"""
from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_serializer


class ProprietarioIn(BaseModel):
    """Um signatário informado na criação (casal, herdeiros etc.)."""
    nome: str = Field(..., min_length=2, max_length=200)
    cpf: Optional[str] = Field(None, max_length=20)
    telefone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=200)


class AutorizacaoCreate(BaseModel):
    imovel_id: str
    # Proprietário: se omitido, puxa do proprietario_id do imóvel.
    proprietario_id: Optional[str] = None
    proprietario_nome: Optional[str] = Field(None, max_length=200)
    proprietario_cpf: Optional[str] = Field(None, max_length=20)
    proprietario_telefone: Optional[str] = Field(None, max_length=40)
    proprietario_email: Optional[str] = Field(None, max_length=200)
    proprietario_endereco: Optional[str] = Field(None, max_length=300)

    # Múltiplos proprietários: quando presente, substitui os campos
    # proprietario_* acima (o primeiro da lista vira o principal).
    proprietarios: Optional[List[ProprietarioIn]] = Field(None, max_length=6)

    tipo_negocio: str = Field("venda", pattern="^(venda|locacao|ambos)$")
    valor_autorizado: Optional[Decimal] = None
    exclusiva: bool = True
    comissao_venda_pct: Optional[Decimal] = Field(Decimal("6"), ge=0, le=100)
    comissao_locacao_desc: Optional[str] = Field("equivalente ao primeiro aluguel", max_length=200)
    prazo_dias: int = Field(180, ge=1, le=730)

    corretor_id: Optional[str] = None


class SignatarioOut(BaseModel):
    id: str
    ordem: int
    nome: str
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    token: str
    status: str
    assinada_em: Optional[str] = None


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

    signatarios: List[SignatarioOut] = []

    @field_serializer("valor_autorizado", "comissao_venda_pct")
    def _ser_dec(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class SignatarioPublico(BaseModel):
    """Resumo dos co-signatários mostrado na página pública."""
    nome: str
    assinou: bool


class AutorizacaoPublicaView(BaseModel):
    """O que o proprietário vê na página de assinatura.

    `status` é o da autorização (pendente/parcial/assinada);
    `signatario_nome`/`ja_assinou` referem-se a quem abriu ESTE link.
    """
    status: str
    signatario_nome: str
    ja_assinou: bool = False
    signatarios: List[SignatarioPublico] = []

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
    clausula_texto: str

    @field_serializer("valor_autorizado", "comissao_venda_pct")
    def _ser_dec(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class AutorizacaoAssinaturaIn(BaseModel):
    aceite: bool
    cpf: str = Field(..., min_length=11, max_length=20)
    assinatura_png: Optional[str] = Field(None, max_length=2_000_000)
    geo: Optional[str] = Field(None, max_length=120)
