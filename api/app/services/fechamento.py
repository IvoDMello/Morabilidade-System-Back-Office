"""Regras compartilhadas do fechamento mensal de locações.

Ponto único para a aritmética que o Repasse ao proprietário e o Demonstrativo
de Administração (cobrança da taxa) têm em comum: parsing da competência,
clamp do vencimento no mês e o cálculo taxa × valor. Antes cada endpoint
carregava a própria cópia — qualquer ajuste de regra precisava ser feito em
dois lugares e era questão de tempo até os PDFs divergirem.

Nota de regra (comportamento atual, preservado aqui):
- Repasse: usa a taxa do contrato como está (0/None ⇒ nada é descontado).
- Adm. (cobrança): taxa do contrato, com fallback de TAXA_ADM_PADRAO quando
  o contrato não tem taxa preenchida.
Contratos com taxa preenchida aparecem nos DOIS fluxos — cabe à operação usar
um ou outro por proprietário, não ambos na mesma competência.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

# Taxa de administração aplicada na cobrança quando o contrato não tem taxa.
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


def taxa_efetiva(taxa_pct, aplicar_padrao: bool) -> Decimal:
    """Taxa do contrato como Decimal. Com `aplicar_padrao`, 0/None vira
    TAXA_ADM_PADRAO (regra da cobrança de administração); sem, fica 0
    (regra do repasse: contrato sem taxa não desconta nada)."""
    pct = Decimal(str(taxa_pct or 0))
    if aplicar_padrao and pct == 0:
        return TAXA_ADM_PADRAO
    return pct


def calcular_taxa(valor, taxa_pct: Decimal) -> Decimal:
    """Comissão/taxa de administração: valor × pct / 100, em centavos."""
    return (Decimal(str(valor or 0)) * taxa_pct / Decimal("100")).quantize(_CENT)
