from datetime import date
from decimal import Decimal
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


# ── Enums ────────────────────────────────────────────────────────────────────

class StatusLocacao(str, Enum):
    ativo = "ativo"
    em_encerramento = "em_encerramento"
    rescindido = "rescindido"
    encerrado = "encerrado"


class StatusPagamento(str, Enum):
    pendente = "pendente"
    pago = "pago"
    atrasado = "atrasado"
    parcial = "parcial"


class TipoAnexo(str, Enum):
    contrato = "contrato"
    aditivo = "aditivo"
    vistoria = "vistoria"
    outro = "outro"


# ── Contrato ─────────────────────────────────────────────────────────────────

class ContratoLocacaoBase(BaseModel):
    imovel_id: str
    proprietario_id: str
    locatario_id: str

    data_inicio: date
    data_fim: date
    dia_vencimento: int = Field(ge=1, le=31)

    aluguel_mensal: Decimal = Field(ge=0)
    condominio_mensal: Decimal = Field(default=Decimal("0"), ge=0)
    incluir_condominio_cobranca: bool = True

    fundo_reserva: Decimal = Field(default=Decimal("0"), ge=0)

    fundo_obra: Decimal = Field(default=Decimal("0"), ge=0)
    incluir_fundo_obra_cobranca: bool = False

    iptu_anual: Decimal = Field(default=Decimal("0"), ge=0)
    incluir_iptu_cobranca: bool = False

    # Seguro incêndio anual — quando incluído, divide por 12 meses (padrão
    # de mercado, distinto do IPTU que segue 10 parcelas no RJ).
    seguro_incendio_anual: Decimal = Field(default=Decimal("0"), ge=0)
    incluir_seguro_incendio_cobranca: bool = False

    numero_iptu: Optional[str] = None
    dados_cobranca_pix: Optional[str] = None
    dados_cobranca_banco: Optional[str] = None
    dados_cobranca_agencia: Optional[str] = None
    dados_cobranca_conta: Optional[str] = None
    observacoes_demonstrativo: Optional[str] = None

    # Repasse ao proprietário (Fase 5) — percentual retido pela imobiliária
    # sobre o aluguel pago, antes do repasse mensal.
    taxa_administracao_pct: Decimal = Field(
        default=Decimal("0"), ge=0, le=100,
    )

    @model_validator(mode="after")
    def vigencia_valida(self) -> "ContratoLocacaoBase":
        if self.data_fim <= self.data_inicio:
            raise ValueError("data_fim deve ser posterior a data_inicio.")
        if self.proprietario_id == self.locatario_id:
            raise ValueError("proprietário e locatário não podem ser o mesmo cliente.")
        return self


class ContratoLocacaoCreate(ContratoLocacaoBase):
    pass


class ContratoLocacaoUpdate(BaseModel):
    """Atualização parcial — todos os campos opcionais.
    Não permite trocar imóvel, proprietário ou locatário (mudaria o que o
    contrato representa; nesses casos, encerre e crie outro)."""
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    dia_vencimento: Optional[int] = Field(default=None, ge=1, le=31)

    aluguel_mensal: Optional[Decimal] = Field(default=None, ge=0)
    condominio_mensal: Optional[Decimal] = Field(default=None, ge=0)
    incluir_condominio_cobranca: Optional[bool] = None

    fundo_reserva: Optional[Decimal] = Field(default=None, ge=0)
    fundo_obra: Optional[Decimal] = Field(default=None, ge=0)
    incluir_fundo_obra_cobranca: Optional[bool] = None

    iptu_anual: Optional[Decimal] = Field(default=None, ge=0)
    incluir_iptu_cobranca: Optional[bool] = None

    seguro_incendio_anual: Optional[Decimal] = Field(default=None, ge=0)
    incluir_seguro_incendio_cobranca: Optional[bool] = None

    numero_iptu: Optional[str] = None
    dados_cobranca_pix: Optional[str] = None
    dados_cobranca_banco: Optional[str] = None
    dados_cobranca_agencia: Optional[str] = None
    dados_cobranca_conta: Optional[str] = None
    observacoes_demonstrativo: Optional[str] = None

    taxa_administracao_pct: Optional[Decimal] = Field(default=None, ge=0, le=100)

    motivo_rescisao: Optional[str] = None
    data_rescisao: Optional[date] = None

    @model_validator(mode="after")
    def vigencia_e_status_validos(self) -> "ContratoLocacaoUpdate":
        # Se ambas as datas vieram no PATCH, valida a coerência.
        # (Se vier só uma, o banco mantém a outra — não dá pra cruzar aqui.)
        if (
            self.data_inicio is not None
            and self.data_fim is not None
            and self.data_fim <= self.data_inicio
        ):
            raise ValueError("data_fim deve ser posterior a data_inicio.")
        return self


class ParteResumo(BaseModel):
    """Resumo de cliente/imóvel anexado ao contrato — evita N queries no front."""
    id: str
    nome: Optional[str] = None
    codigo: Optional[str] = None
    endereco: Optional[str] = None


class ContratoLocacaoOut(ContratoLocacaoBase):
    id: str
    status: StatusLocacao
    motivo_rescisao: Optional[str] = None
    data_rescisao: Optional[date] = None
    created_at: str
    updated_at: str

    imovel: Optional[ParteResumo] = None
    proprietario: Optional[ParteResumo] = None
    locatario: Optional[ParteResumo] = None


class ContratoLocacaoListItem(BaseModel):
    id: str
    status: StatusLocacao
    data_inicio: date
    data_fim: date
    dia_vencimento: int
    aluguel_mensal: Decimal
    imovel: Optional[ParteResumo] = None
    proprietario: Optional[ParteResumo] = None
    locatario: Optional[ParteResumo] = None
    created_at: str


class RescindirContrato(BaseModel):
    motivo_rescisao: str
    data_rescisao: date


# ── Pagamentos ──────────────────────────────────────────────────────────────

class PagamentoCreate(BaseModel):
    mes_referencia: date
    valor_devido: Decimal = Field(ge=0)
    data_vencimento: date
    valor_pago: Optional[Decimal] = Field(default=None, ge=0)
    data_pagamento: Optional[date] = None
    status: StatusPagamento = StatusPagamento.pendente
    observacoes: Optional[str] = None


class PagamentoUpdate(BaseModel):
    valor_devido: Optional[Decimal] = Field(default=None, ge=0)
    valor_pago: Optional[Decimal] = Field(default=None, ge=0)
    data_vencimento: Optional[date] = None
    data_pagamento: Optional[date] = None
    status: Optional[StatusPagamento] = None
    observacoes: Optional[str] = None


class PagamentoOut(BaseModel):
    id: str
    contrato_id: str
    mes_referencia: date
    valor_devido: Decimal
    valor_pago: Optional[Decimal] = None
    data_vencimento: date
    data_pagamento: Optional[date] = None
    status: StatusPagamento
    observacoes: Optional[str] = None
    created_at: str
    updated_at: str


# ── Anexos ──────────────────────────────────────────────────────────────────

class AnexoOut(BaseModel):
    id: str
    contrato_id: str
    tipo: TipoAnexo
    nome_arquivo: str
    firebase_path: str
    tamanho_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by: Optional[str] = None
    url: Optional[str] = None  # Resolvida na hora — não persistida no banco.


# ── Reajuste (Fase 5) ───────────────────────────────────────────────────────

class ReajusteCreate(BaseModel):
    data_aplicacao: date
    percentual: Decimal = Field(description="Ex: 4.25 = +4,25%; aceita negativo")
    indice_referencia: Optional[str] = None  # IGPM, IPCA, etc.
    observacoes: Optional[str] = None


class ReajusteOut(BaseModel):
    id: str
    contrato_id: str
    data_aplicacao: date
    percentual: Decimal
    aluguel_anterior: Decimal
    aluguel_novo: Decimal
    indice_referencia: Optional[str] = None
    observacoes: Optional[str] = None
    applied_by: Optional[str] = None
    created_at: str


# ── Repasse ao proprietário (Fase 5) ────────────────────────────────────────

class RepasseItem(BaseModel):
    """Uma linha do relatório de repasses do mês: um contrato pago."""
    contrato_id: str
    imovel_codigo: Optional[str] = None
    imovel_endereco: Optional[str] = None
    pagamento_id: str
    valor_pago: Decimal
    taxa_administracao_pct: Decimal
    valor_taxa: Decimal
    valor_repasse: Decimal


class RepasseProprietario(BaseModel):
    proprietario_id: str
    nome: str
    email: Optional[str] = None
    total_recebido: Decimal
    total_taxa: Decimal
    total_repasse: Decimal
    itens: list[RepasseItem]


class RepasseResumo(BaseModel):
    mes: str
    proprietarios: list[RepasseProprietario]
    total_recebido: Decimal
    total_taxa: Decimal
    total_repasse: Decimal
