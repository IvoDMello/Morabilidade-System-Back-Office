"""Geração do Relatório de Visitas do imóvel em PDF (ReportLab).

Documento que a imobiliária entrega ao proprietário para comprovar o giro do
imóvel: quantas visitas aconteceram, quem visitou e quando. Sai da mesma fonte
do relatório de 30 dias ([relatorio_30dias_pdf]), as fichas de visita
ASSINADAS, mas cobre o histórico inteiro em vez da janela de 30 dias e é
gerado sob demanda, não pelo job.

O visitante aparece só com nome e sobrenome e com o telefone mascarado
("219 **** - 9990"): o proprietário confere que as visitas são reais e de
pessoas distintas sem levar embora a base de contatos. Os dois formatadores
vivem em [pdf_base], junto com header/footer/seção/campo.
"""
from __future__ import annotations

import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.config import settings
from app.services.pdf_base import (
    DOURADO_CLARO,
    LINHA,
    MARGEM,
    TEXTO_CLARO,
    TEXTO_ESCURO,
    campo,
    draw_brand_footer,
    draw_brand_header,
    fmt_dt,
    mascarar_telefone,
    nome_e_sobrenome,
    secao,
)

# Abaixo deste Y começamos uma nova página (deixa folga para o rodapé).
_LIMITE_RODAPE = 28 * mm

# Colunas da tabela de visitas, medidas a partir da margem esquerda.
_COL_NOME = MARGEM
_COL_DATA = MARGEM + 92 * mm
_COL_TEL = MARGEM + 128 * mm
# Espaço útil da coluna do visitante, até onde começa a data.
_LARGURA_NOME = _COL_DATA - _COL_NOME - 4 * mm


def _nome_na_coluna(c: canvas.Canvas, nome: str) -> str:
    """Encurta o nome que não couber na coluna, pra nunca invadir a data."""
    while c.stringWidth(nome, "Helvetica", 9) > _LARGURA_NOME and len(nome) > 4:
        nome = nome[:-2]
    return nome


def _rodape(c: canvas.Canvas, largura: float) -> None:
    rodape_esq = " · ".join(filter(None, [
        settings.empresa_creci_juridico or settings.empresa_creci_corretor,
        f"CNPJ {settings.empresa_cnpj}" if settings.empresa_cnpj else None,
    ])) or "MORABILIDADE: Intermediação imobiliária"
    draw_brand_footer(c, largura, esquerda=rodape_esq, direita=settings.empresa_telefone)


def _cabecalho_tabela(c: canvas.Canvas, largura: float, y: float) -> float:
    """Faixa clara com os rótulos das colunas. Devolve o Y da primeira linha."""
    util = largura - 2 * MARGEM
    barra_h = 6 * mm
    c.setFillColor(DOURADO_CLARO)
    c.rect(MARGEM, y - barra_h, util, barra_h, fill=1, stroke=0)
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(_COL_NOME + 2 * mm, y - barra_h + 2 * mm, "VISITANTE")
    c.drawString(_COL_DATA, y - barra_h + 2 * mm, "DATA DA VISITA")
    c.drawString(_COL_TEL, y - barra_h + 2 * mm, "TELEFONE")
    return y - barra_h - 6 * mm


def _nova_pagina(c: canvas.Canvas, largura: float, altura: float) -> float:
    """Fecha a página atual (com rodapé), abre outra com o cabeçalho de marca e
    o cabeçalho da tabela, para a lista continuar legível na virada."""
    _rodape(c, largura)
    c.showPage()
    y = draw_brand_header(c, largura, altura, header_mm=30, titulo="RELATÓRIO DE VISITAS")
    return _cabecalho_tabela(c, largura, y - 12 * mm)


def gerar_relatorio_visitas_pdf(dados: dict) -> bytes:
    """Gera o PDF do relatório de visitas do imóvel e devolve os bytes.

    `dados` esperado:
        codigo, endereco, anunciado_em, emitido_em,
        visitas (list[{nome, data, telefone}], já ordenadas).
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    util = largura - 2 * MARGEM

    y = draw_brand_header(c, largura, altura, header_mm=30, titulo="RELATÓRIO DE VISITAS")
    y -= 12 * mm

    # ── 1. Imóvel ────────────────────────────────────────────────────────────
    y = secao(c, largura, y, "1. Imóvel")
    campo(c, MARGEM, y, 40 * mm, "Código / ref.", dados.get("codigo") or "-")
    campo(c, MARGEM + 46 * mm, y, util - 46 * mm, "Endereço", dados.get("endereco") or "-")
    y -= 12 * mm
    campo(c, MARGEM, y, 60 * mm, "Anunciado em", dados.get("anunciado_em") or "-")
    campo(c, MARGEM + 66 * mm, y, util - 66 * mm, "Relatório emitido em", dados.get("emitido_em") or "-")
    y -= 16 * mm

    # ── 2. Visitas realizadas ────────────────────────────────────────────────
    y = secao(c, largura, y, "2. Visitas realizadas")
    visitas = dados.get("visitas") or []
    qtd = len(visitas)

    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGEM, y, f"{qtd} visita{'s' if qtd != 1 else ''} com ficha de visita registrada.")
    y -= 5 * mm
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica", 7.5)
    c.drawString(MARGEM, y,
                 "O telefone aparece parcialmente oculto por se tratar de dado pessoal do visitante (LGPD).")
    y -= 8 * mm

    if visitas:
        y = _cabecalho_tabela(c, largura, y)
        for v in visitas:
            if y < _LIMITE_RODAPE:
                y = _nova_pagina(c, largura, altura)
            c.setFillColor(TEXTO_ESCURO)
            c.setFont("Helvetica", 9)
            c.drawString(_COL_NOME + 2 * mm, y, _nome_na_coluna(c, nome_e_sobrenome(v.get("nome"))))
            c.setFillColor(TEXTO_CLARO)
            c.setFont("Helvetica", 9)
            c.drawString(_COL_DATA, y, fmt_dt(v.get("data")))
            c.drawString(_COL_TEL, y, mascarar_telefone(v.get("telefone")))
            c.setStrokeColor(LINHA)
            c.setLineWidth(0.4)
            c.line(MARGEM, y - 2.5 * mm, MARGEM + util, y - 2.5 * mm)
            y -= 7 * mm
    else:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(MARGEM, y, "Nenhuma visita com ficha de visita registrada neste imóvel.")
        y -= 7 * mm

    # ── Footer ───────────────────────────────────────────────────────────────
    _rodape(c, largura)

    c.showPage()
    c.save()
    return buffer.getvalue()
