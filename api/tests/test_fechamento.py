"""Testes do serviço compartilhado de fechamento mensal (app.services.fechamento).

É a aritmética usada pelo Repasse e pelo Demonstrativo de Administração —
qualquer regressão aqui muda valor em PDF/relatório financeiro.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.services.fechamento import (
    TAXA_ADM_PADRAO,
    calcular_taxa,
    parse_mes,
    taxa_efetiva,
    ultimo_dia_do_mes,
    vencimento_no_mes,
)


# ── parse_mes ────────────────────────────────────────────────────────────────

def test_parse_mes_valido():
    assert parse_mes("2026-05") == date(2026, 5, 1)
    assert parse_mes("2026-12") == date(2026, 12, 1)


@pytest.mark.parametrize("ruim", ["2026-13", "2026-00", "2026/05", "05-2026", "abc", "", "2026-5"])
def test_parse_mes_invalido(ruim):
    with pytest.raises(ValueError):
        parse_mes(ruim)


# ── ultimo_dia_do_mes / vencimento_no_mes ────────────────────────────────────

def test_ultimo_dia_do_mes():
    assert ultimo_dia_do_mes(date(2026, 1, 1)) == 31
    assert ultimo_dia_do_mes(date(2026, 4, 1)) == 30
    assert ultimo_dia_do_mes(date(2026, 2, 1)) == 28
    assert ultimo_dia_do_mes(date(2028, 2, 1)) == 29  # bissexto
    assert ultimo_dia_do_mes(date(2026, 12, 1)) == 31  # virada de ano


def test_vencimento_clampa_no_fim_do_mes():
    # Dia 31 em abril vira 30; dia 30 em fevereiro vira 28.
    assert vencimento_no_mes(31, date(2026, 4, 1)) == date(2026, 4, 30)
    assert vencimento_no_mes(30, date(2026, 2, 1)) == date(2026, 2, 28)
    assert vencimento_no_mes(10, date(2026, 5, 1)) == date(2026, 5, 10)


def test_vencimento_sem_dia_usa_padrao():
    assert vencimento_no_mes(None, date(2026, 5, 1)) == date(2026, 5, 5)
    assert vencimento_no_mes(0, date(2026, 5, 1)) == date(2026, 5, 5)


# ── taxa_efetiva ─────────────────────────────────────────────────────────────

def test_taxa_do_contrato_prevalece_nos_dois_fluxos():
    assert taxa_efetiva(10, aplicar_padrao=True) == Decimal("10")
    assert taxa_efetiva("7.5", aplicar_padrao=False) == Decimal("7.5")


def test_sem_taxa_cobranca_aplica_padrao_e_repasse_nao():
    # Regra atual: cobrança de adm. usa 8% de fallback; repasse não desconta.
    for vazio in (None, 0, "0"):
        assert taxa_efetiva(vazio, aplicar_padrao=True) == TAXA_ADM_PADRAO
        assert taxa_efetiva(vazio, aplicar_padrao=False) == Decimal("0")


def test_taxa_padrao_e_8_pct():
    assert TAXA_ADM_PADRAO == Decimal("8")


# ── calcular_taxa ────────────────────────────────────────────────────────────

def test_calcular_taxa_basico():
    assert calcular_taxa(1000, Decimal("8")) == Decimal("80.00")
    assert calcular_taxa("2500.00", Decimal("10")) == Decimal("250.00")


def test_calcular_taxa_arredonda_em_centavos():
    # 1234.56 × 8% = 98.7648 → 98.76 (ROUND_HALF_EVEN do quantize padrão)
    assert calcular_taxa("1234.56", Decimal("8")) == Decimal("98.76")
    # 333.33 × 7.5% = 24.99975 → 25.00
    assert calcular_taxa("333.33", Decimal("7.5")) == Decimal("25.00")


def test_calcular_taxa_valores_vazios():
    assert calcular_taxa(None, Decimal("8")) == Decimal("0.00")
    assert calcular_taxa(0, Decimal("8")) == Decimal("0.00")
    assert calcular_taxa(1000, Decimal("0")) == Decimal("0.00")
