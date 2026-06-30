"""Geração do "Demonstrativo de Administração" em PDF.

Diferente do demonstrativo de locação ([demonstrativo_pdf], que cobra o
inquilino): este documento é a COBRANÇA da taxa de administração ao
PROPRIETÁRIO. O proprietário recebe o aluguel direto e paga à imobiliária um
percentual (taxa_administracao_pct) sobre o aluguel cheio de cada imóvel
administrado. Reproduz o layout do demonstrativo de referência da Fernanda.

Stack: ReportLab puro (sem Cairo/Pango), igual aos demais PDFs do projeto.
"""
from __future__ import annotations

import io
from datetime import date
from decimal import Decimal
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from app.services.pdf_base import (
    DOURADO,
    LINHA,
    MESES_PT,
    OLIVE,
    TEXTO_CLARO,
    TEXTO_ESCURO,
    draw_brand_footer,
    draw_brand_header,
    fmt_brl,
)

MARGEM = 15 * mm


def _primeiro_nome(nome: str) -> str:
    return (nome or "").strip().split(" ")[0] or "proprietário(a)"


def _truncar(c: canvas.Canvas, texto: str, fonte: str, tam: float, largura_max: float) -> str:
    """Trunca com reticências para caber em `largura_max` (em pontos)."""
    if not texto:
        return ""
    if pdfmetrics.stringWidth(texto, fonte, tam) <= largura_max:
        return texto
    while texto and pdfmetrics.stringWidth(texto + "…", fonte, tam) > largura_max:
        texto = texto[:-1]
    return texto + "…"


def _fmt_pct(pct: Decimal) -> str:
    """Formata percentual sem casas desnecessárias: 8 -> '8', 8.5 -> '8,5'."""
    s = f"{float(pct):.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def gerar_demonstrativo_admin_pdf(
    bloco: dict,
    mes_referencia: date,
    dados_recebimento: dict,
) -> bytes:
    """Gera o PDF e devolve os bytes.

    `bloco` espera as chaves: nome, itens (lista de dicts com imovel_codigo,
    imovel_endereco, bairro, locatario_nome, aluguel, taxa_administracao_pct,
    comissao), total_aluguel, total_comissao, pct_uniforme (Decimal ou None).
    `dados_recebimento` espera: titular, banco, agencia, conta, pix.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4

    # ── Header olive com título + competência ────────────────────────────────
    header_mm = 36
    draw_brand_header(c, largura, altura, header_mm=header_mm)
    mes_label = f"{MESES_PT[mes_referencia.month - 1]} de {mes_referencia.year}"
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(largura - MARGEM, altura - 15 * mm, "Demonstrativo de Administração")
    c.setFillColor(DOURADO)
    c.setFont("Helvetica", 11)
    c.drawRightString(largura - MARGEM, altura - 22 * mm, f"Competência: {mes_label}")

    nome = bloco.get("nome") or "—"
    pnome = _primeiro_nome(nome)
    itens = bloco.get("itens") or []
    qtd = len(itens)

    y = altura - header_mm * mm - 16 * mm

    # ── Saudação + introdução ────────────────────────────────────────────────
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(MARGEM, y, f"Olá, {pnome}!")
    y -= 9 * mm

    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica", 11)
    plural = "s" if qtd != 1 else ""
    intro = (
        f"Segue o resumo dos serviços de administração do{plural} seu{plural} "
        f"{qtd} imóve{'is' if qtd != 1 else 'l'} no mês de {mes_label}."
    )
    c.drawString(MARGEM, y, intro)
    y -= 5 * mm
    c.drawString(MARGEM, y, "Qualquer dúvida, é só chamar — estamos por aqui.")
    y -= 12 * mm

    # ── Título da seção ──────────────────────────────────────────────────────
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 11)
    titulo_sec = "CARTEIRA DE IMÓVEIS ADMINISTRADOS"
    c.drawString(MARGEM, y, titulo_sec)
    larg_titulo = pdfmetrics.stringWidth(titulo_sec, "Helvetica-Bold", 11)
    c.setStrokeColor(DOURADO)
    c.setLineWidth(2)
    c.line(MARGEM, y - 2 * mm, MARGEM + larg_titulo, y - 2 * mm)
    y -= 9 * mm

    # ── Tabela ───────────────────────────────────────────────────────────────
    x_codigo = MARGEM
    x_imovel = 40 * mm
    x_bairro = 118 * mm
    x_aluguel_r = 162 * mm
    x_comissao_r = largura - MARGEM
    largura_imovel = x_bairro - x_imovel - 4 * mm
    largura_bairro = x_aluguel_r - 24 * mm - x_bairro

    pct_uniforme = bloco.get("pct_uniforme")
    if pct_uniforme is not None:
        header_comissao = f"COMISSÃO ({_fmt_pct(Decimal(str(pct_uniforme)))}%)"
    else:
        header_comissao = "COMISSÃO"

    # Cabeçalho da tabela
    head_h = 8 * mm
    c.setFillColor(colors.HexColor("#f1efe4"))
    c.rect(MARGEM, y - head_h, largura - 2 * MARGEM, head_h, fill=1, stroke=0)
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica-Bold", 8)
    base_h = y - head_h + 2.6 * mm
    c.drawString(x_codigo + 2 * mm, base_h, "CÓDIGO")
    c.drawString(x_imovel, base_h, "IMÓVEL / LOCATÁRIO")
    c.drawString(x_bairro, base_h, "BAIRRO")
    c.drawRightString(x_aluguel_r, base_h, "ALUGUEL")
    c.drawRightString(x_comissao_r, base_h, header_comissao)
    y -= head_h

    # Linhas
    row_h = 13 * mm
    for it in itens:
        codigo = it.get("imovel_codigo") or "—"
        endereco = it.get("imovel_endereco") or "—"
        locatario = it.get("locatario_nome") or "—"
        bairro = it.get("bairro") or "—"
        aluguel = Decimal(str(it.get("aluguel") or 0))
        comissao = Decimal(str(it.get("comissao") or 0))

        topo = y
        # Código
        c.setFillColor(TEXTO_ESCURO)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x_codigo + 2 * mm, topo - 5.5 * mm, codigo)
        # Imóvel (endereço bold + locatário light)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x_imovel, topo - 4.5 * mm,
                     _truncar(c, endereco, "Helvetica-Bold", 9, largura_imovel))
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica", 8.5)
        c.drawString(x_imovel, topo - 9 * mm,
                     _truncar(c, locatario, "Helvetica", 8.5, largura_imovel))
        # Bairro
        c.setFillColor(TEXTO_ESCURO)
        c.setFont("Helvetica", 9)
        c.drawString(x_bairro, topo - 5.5 * mm,
                     _truncar(c, bairro, "Helvetica", 9, largura_bairro))
        # Valores
        c.drawRightString(x_aluguel_r, topo - 5.5 * mm, fmt_brl(aluguel))
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(x_comissao_r, topo - 5.5 * mm, fmt_brl(comissao))

        # Divisória
        c.setStrokeColor(LINHA)
        c.setLineWidth(0.5)
        c.line(MARGEM, topo - row_h, largura - MARGEM, topo - row_h)
        y -= row_h

    # Linha de totais
    total_aluguel = Decimal(str(bloco.get("total_aluguel") or 0))
    total_comissao = Decimal(str(bloco.get("total_comissao") or 0))
    tot_h = 11 * mm
    c.setFillColor(colors.HexColor("#fdfaef"))
    c.rect(MARGEM, y - tot_h, largura - 2 * MARGEM, tot_h, fill=1, stroke=0)
    c.setFillColor(OLIVE)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x_codigo + 2 * mm, y - tot_h + 3.8 * mm,
                 f"TOTAIS  ({qtd} imóve{'is' if qtd != 1 else 'l'})")
    c.drawRightString(x_aluguel_r, y - tot_h + 3.8 * mm, fmt_brl(total_aluguel))
    c.drawRightString(x_comissao_r, y - tot_h + 3.8 * mm, fmt_brl(total_comissao))
    y -= tot_h + 14 * mm

    # ── Dois boxes: dados para pagamento + resumo do mês ─────────────────────
    box_h = 42 * mm
    gap = 8 * mm
    box_w = (largura - 2 * MARGEM - gap) / 2
    box_y = y - box_h

    # Box esquerdo — Dados para pagamento (contorno)
    c.setStrokeColor(LINHA)
    c.setLineWidth(0.8)
    c.roundRect(MARGEM, box_y, box_w, box_h, 4 * mm, fill=0, stroke=1)
    bx = MARGEM + 6 * mm
    by = y - 7 * mm
    c.setFillColor(OLIVE)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(bx, by, "DADOS PARA PAGAMENTO")
    by -= 6 * mm
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(bx, by, _truncar(c, dados_recebimento.get("titular") or "—",
                                  "Helvetica-Bold", 11, box_w - 12 * mm))
    by -= 7 * mm
    for label, valor in (
        ("Banco", dados_recebimento.get("banco")),
        ("Agência", dados_recebimento.get("agencia")),
        ("Conta", dados_recebimento.get("conta")),
        ("PIX", dados_recebimento.get("pix")),
    ):
        if not valor:
            continue
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica", 9)
        c.drawString(bx, by, label)
        c.setFillColor(TEXTO_ESCURO)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(bx + 20 * mm, by, str(valor))
        by -= 5.5 * mm

    # Box direito — Resumo do mês (olive preenchido)
    rx0 = MARGEM + box_w + gap
    c.setFillColor(OLIVE)
    c.roundRect(rx0, box_y, box_w, box_h, 4 * mm, fill=1, stroke=0)
    rx = rx0 + 6 * mm
    ry = y - 7 * mm
    c.setFillColor(DOURADO)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(rx, ry, "RESUMO DO MÊS")
    ry -= 7 * mm
    c.setFillColor(colors.HexColor("#d8d8d0"))
    c.setFont("Helvetica", 9)
    c.drawString(rx, ry, "Total de aluguéis administrados")
    ry -= 7 * mm
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(rx, ry, fmt_brl(total_aluguel))
    ry -= 9 * mm
    c.setFillColor(colors.HexColor("#d8d8d0"))
    c.setFont("Helvetica", 9)
    sufixo_pct = f" ({_fmt_pct(Decimal(str(pct_uniforme)))}%)" if pct_uniforme is not None else ""
    c.drawString(rx, ry, f"Total de serviços a pagar{sufixo_pct}")
    ry -= 7 * mm
    c.setFillColor(DOURADO)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(rx, ry, fmt_brl(total_comissao))

    y = box_y - 12 * mm

    # ── Fechamento ───────────────────────────────────────────────────────────
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica-Oblique", 10.5)
    c.drawString(
        MARGEM, y,
        f"Obrigado pela parceria de sempre, {pnome}. Seguimos cuidando da sua "
        "carteira com o",
    )
    y -= 5 * mm
    c.drawString(MARGEM, y, "mesmo zelo do primeiro dia.")

    draw_brand_footer(c, largura)

    c.showPage()
    c.save()
    return buffer.getvalue()
