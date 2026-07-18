"""Regras compartilhadas do fechamento mensal de locações.

Ponto único para a aritmética que o Repasse ao proprietário e o Demonstrativo
de Administração (cobrança da taxa) têm em comum: parsing da competência,
clamp do vencimento no mês e o cálculo taxa × valor. Antes cada endpoint
carregava a própria cópia, qualquer ajuste de regra precisava ser feito em
dois lugares e era questão de tempo até os PDFs divergirem.

Regra vigente (decisão do Ivo, 01/07/2026): a taxa de administração é FIXA em
8% (TAXA_ADM_PADRAO) para todos os contratos, o campo taxa_administracao_pct
do contrato é ignorado nos cálculos. Para não haver cobrança em dobro, o
Demonstrativo de Administração exclui contratos cujo aluguel do mês passou
pela imobiliária (pagamento pago/parcial na competência): nesses, os 8% já
foram retidos no Repasse.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

# Taxa de administração única da operação (8% sobre o aluguel).
TAXA_ADM_PADRAO = Decimal("8")

_MES_RE = re.compile(r"^(\d{4})-(\d{2})$")

_CENT = Decimal("0.01")


def parse_mes(mes_str: str) -> date:
    """Converte 'YYYY-MM' em date(YYYY, MM, 1). Levanta ValueError se inválido."""
    m = _MES_RE.match(mes_str or "")
    if not m:
        raise ValueError("Parâmetro 'mes' deve estar no formato YYYY-MM (ex: 2026-05).")
    ano, mes = int(m.group(1)), int(m.group(2))
    if not (1 <= mes <= 12):
        raise ValueError("Mês inválido.")
    return date(ano, mes, 1)


def ultimo_dia_do_mes(d: date) -> int:
    prox = date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)
    return (prox - timedelta(days=1)).day


def vencimento_no_mes(dia_vencimento: Optional[int], mes_ref: date, padrao: int = 5) -> date:
    """Data de vencimento na competência, clampando o dia ao fim do mês
    (dia 31 em abril ⇒ 30; dia 30 em fevereiro ⇒ 28/29)."""
    dia = int(dia_vencimento or padrao)
    return date(mes_ref.year, mes_ref.month, min(dia, ultimo_dia_do_mes(mes_ref)))


def calcular_taxa(valor, taxa_pct: Decimal = TAXA_ADM_PADRAO) -> Decimal:
    """Comissão/taxa de administração: valor × pct / 100, em centavos.
    Sem `taxa_pct`, usa a taxa única da operação (8%)."""
    return (Decimal(str(valor or 0)) * taxa_pct / Decimal("100")).quantize(_CENT)
