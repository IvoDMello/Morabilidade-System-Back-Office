"""Helpers compartilhados de geração de PDF (ReportLab).

Centraliza a identidade visual Morabilidade (cores, header/footer, logo) e os
formatadores BR usados pelos documentos do sistema — demonstrativo de locação
([demonstrativo_pdf]) e ficha de visita ([ficha_visita_pdf]).

Stack: ReportLab puro (sem Cairo/Pango), por rodar igual no Windows local e no
Docker do Railway.
"""
from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# ── Identidade visual Morabilidade ───────────────────────────────────────────
OLIVE = colors.HexColor("#585a4f")
DOURADO = colors.HexColor("#d8cb6a")
DOURADO_CLARO = colors.HexColor("#fdfaef")
TEXTO_ESCURO = colors.HexColor("#1f2937")
TEXTO_CLARO = colors.HexColor("#64748b")
LINHA = colors.HexColor("#e2e8f0")

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo.png")


# ── Formatadores ─────────────────────────────────────────────────────────────

def dec(v) -> Decimal:
    """Aceita None, str, float, int, Decimal — devolve Decimal."""
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


def fmt_brl(valor: Decimal | float | int) -> str:
    """Formata como R$ 1.234,56 (padrão BR)."""
    v = float(valor)
    # Truque clássico: format en-US e depois swap , <-> .
    s = f"{v:,.2f}"
    return "R$ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_data(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def quebrar_em_linhas(texto: str, max_chars: int) -> list[str]:
    """Quebra simples por palavra. ReportLab não tem reflow nativo no canvas."""
    palavras = texto.split()
    linhas: list[str] = []
    atual = ""
    for p in palavras:
        candidato = (atual + " " + p).strip()
        if len(candidato) <= max_chars:
            atual = candidato
        else:
            if atual:
                linhas.append(atual)
            atual = p
    if atual:
        linhas.append(atual)
    return linhas


# ── Header / Footer de marca ─────────────────────────────────────────────────

def draw_brand_header(
    c: canvas.Canvas,
    largura: float,
    altura: float,
    *,
    header_mm: float = 36,
    titulo: str | None = None,
    tagline: str | None = None,
) -> float:
    """Desenha a faixa olive com o logo e (à direita) um título ou a tagline.

    Mantém o documento robusto a logo ausente — em testes ou ambientes mínimos
    a falha de imagem nunca impede a emissão. Devolve a coordenada Y logo abaixo
    da faixa, para o conteúdo continuar dali.
    """
    header_h = header_mm * mm
    c.setFillColor(OLIVE)
    c.rect(0, altura - header_h, largura, header_h, fill=1, stroke=0)

    if os.path.exists(LOGO_PATH):
        try:
            c.drawImage(
                LOGO_PATH,
                15 * mm, altura - header_h + 4 * mm,
                width=64 * mm, height=28 * mm,
                preserveAspectRatio=True, mask="auto",
            )
        except Exception:
            pass

    texto_dir = titulo or tagline
    if texto_dir:
        c.setFillColor(DOURADO)
        c.setFont("Helvetica-Bold", 14)
        c.drawRightString(largura - 15 * mm, altura - header_h / 2 - 1 * mm, texto_dir)

    return altura - header_h


def draw_brand_footer(
    c: canvas.Canvas,
    largura: float,
    *,
    esquerda: str = "www.morabilidade.com",
    direita: str = "(21) 99772-9990",
    footer_mm: float = 16,
) -> None:
    """Faixa olive de rodapé com dois textos (esquerda/direita)."""
    footer_h = footer_mm * mm
    c.setFillColor(OLIVE)
    c.rect(0, 0, largura, footer_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 11)
    c.drawString(15 * mm, footer_h / 2 - 2 * mm, esquerda)
    c.drawRightString(largura - 15 * mm, footer_h / 2 - 2 * mm, direita)
