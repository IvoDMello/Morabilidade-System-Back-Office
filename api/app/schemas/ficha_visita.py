"""Schemas da Ficha / Termo de Visita a Imóvel.

A ficha vincula o visitante ao pagamento da corretagem (arts. 725 e 727 do
Código Civil) e é assinada eletronicamente (assinatura simples + trilha de
auditoria). Ver router `fichas_visita` e serviço `ficha_visita_pdf`.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_serializer


class FichaVisitaCreate(BaseModel):
    imovel_id: str
    visitante_nome: str = Field(..., min_length=2, max_length=200)
    visitante_cpf: Optional[str] = Field(None, max_length=20)
    visitante_rg: Optional[str] = Field(None, max_length=30)
    visitante_telefone: Optional[str] = Field(None, max_length=40)
    visitante_email: Optional[str] = Field(None, max_length=200)
    # Se informado, vincula a ficha a um cliente/lead já cadastrado.
    cliente_id: Optional[str] = None
    # Default = usuário autenticado (resolvido no router).
    corretor_id: Optional[str] = None
    prazo_meses: int = Field(12, ge=1, le=60)


class FichaVisitaOut(BaseModel):
    id: str
    imovel_id: str
    cliente_id: Optional[str] = None
    corretor_id: Optional[str] = None

    visitante_nome: str
    visitante_cpf: Optional[str] = None
    visitante_rg: Optional[str] = None
    visitante_telefone: Optional[str] = None
    visitante_email: Optional[str] = None

    imovel_codigo: Optional[str] = None
    imovel_endereco: Optional[str] = None
    imovel_bairro: Optional[str] = None
    imovel_cidade: Optional[str] = None
    imovel_valor: Optional[Decimal] = None
    proprietario_nome: Optional[str] = None
    corretor_nome: Optional[str] = None
    corretor_creci: Optional[str] = None
    prazo_meses: int = 12

    status: str
    token: str
    token_expira_em: Optional[str] = None

    assinada_em: Optional[str] = None
    documento_hash: Optional[str] = None

    created_at: str

    @field_serializer("imovel_valor")
    def _serializar_valor(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class FichaVisitaPublicaView(BaseModel):
    """O que o visitante vê na página de assinatura — sem ids internos."""
    status: str
    visitante_nome: str
    imovel_codigo: Optional[str] = None
    imovel_endereco: Optional[str] = None
    imovel_bairro: Optional[str] = None
    imovel_cidade: Optional[str] = None
    imovel_valor: Optional[Decimal] = None
    proprietario_nome: Optional[str] = None
    corretor_nome: Optional[str] = None
    corretor_creci: Optional[str] = None
    clausula_texto: str
    prazo_meses: int = 12

    @field_serializer("imovel_valor")
    def _serializar_valor(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class FichaVisitaAssinaturaIn(BaseModel):
    """Dados enviados pelo visitante ao assinar. IP e User-Agent são capturados
    no servidor (não confiáveis se viessem do cliente)."""
    aceite: bool
    cpf: str = Field(..., min_length=11, max_length=20)
    # Data URL (image/png base64) do traço da assinatura no canvas — opcional.
    assinatura_png: Optional[str] = Field(None, max_length=2_000_000)
    # "lat,lng" capturado via navigator.geolocation, com consentimento — opcional.
    geo: Optional[str] = Field(None, max_length=120)
