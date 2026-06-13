"""Geração do Relatório de 30 dias em PDF (ReportLab).

Resumo de transparência enviado ao acompanhamento (hoje interno; futuro:
proprietário) quando o imóvel completa 30 dias em portfólio. Reúne os dados do
proprietário, do imóvel, as visitas COMPROVADAS (fichas de visita assinadas) e a
análise qualitativa da equipe (percepções).

Componentes de layout (header/footer/seção/campo) vivem em [pdf_base]. As visitas
vêm de `fichas_visita` (status 'assinada'), não mais do cadastro manual da aba de
acompanhamento — ver [imovel_acompanhamento].
"""
from __future__ import annotations

import io

from reportlab.lib import colors
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
    quebrar_em_linhas,
    secao,
)

# Abaixo deste Y começamos uma nova página (deixa folga para o rodapé).
_LIMITE_RODAPE = 28 * mm


def _rodape(c: canvas.Canvas, largura: float) -> None:
    rodape_esq = " · ".join(filter(None, [
        settings.empresa_creci_juridico or settings.empresa_creci_corretor,
        f"CNPJ {settings.empresa_cnpj}" if settings.empresa_cnpj else None,
    ])) or "MORABILIDADE — Intermediação imobiliária"
    draw_brand_footer(c, largura, esquerda=rodape_esq, direita=settings.empresa_telefone)


def _nova_pagina(c: canvas.Canvas, largura: float, altura: float) -> float:
    """Fecha a página atual (com rodapé), abre outra com o cabeçalho e devolve o Y."""
    _rodape(c, largura)
    c.showPage()
    y = draw_brand_header(c, largura, altura, header_mm=30, titulo="RELATÓRIO DE 30 DIAS")
    return y - 12 * mm


def gerar_relatorio_30dias_pdf(dados: dict) -> bytes:
    """Gera o PDF do relatório de 30 dias e devolve os bytes.

    `dados` esperado:
        proprietario_nome, proprietario_telefone, codigo, endereco, anunciado_em,
        visitas_comprovadas (int), visitas (list[{nome, data}]),
        percepcoes (list[{texto, created_at}]).
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    util = largura - 2 * MARGEM

    y = draw_brand_header(c, largura, altura, header_mm=30, titulo="RELATÓRIO DE 30 DIAS")
    y -= 12 * mm

    # ── 1. Proprietário ──────────────────────────────────────────────────────
    y = secao(c, largura, y, "1. Proprietário")
    campo(c, MARGEM, y, 110 * mm, "Nome", dados.get("proprietario_nome") or "—")
    campo(c, MARGEM + 116 * mm, y, util - 116 * mm, "Telefone / WhatsApp",
          dados.get("proprietario_telefone") or "—")
    y -= 16 * mm

    # ── 2. Imóvel ────────────────────────────────────────────────────────────
    y = secao(c, largura, y, "2. Imóvel")
    campo(c, MARGEM, y, 40 * mm, "Código / ref.", dados.get("codigo") or "—")
    campo(c, MARGEM + 46 * mm, y, util - 46 * mm, "Endereço", dados.get("endereco") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, util, "Anunciado em", dados.get("anunciado_em") or "—")
    y -= 16 * mm

    # ── 3. Visitas comprovadas ───────────────────────────────────────────────
    y = secao(c, largura, y, "3. Visitas comprovadas")
    visitas = dados.get("visitas") or []
    qtd = dados.get("visitas_comprovadas", len(visitas))

    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGEM, y, f"{qtd} visita{'s' if qtd != 1 else ''} com ficha assinada nos últimos 30 dias.")
    y -= 9 * mm

    if visitas:
        for v in visitas:
            if y < _LIMITE_RODAPE:
                y = _nova_pagina(c, largura, altura)
            c.setFillColor(TEXTO_CLARO)
            c.setFont("Helvetica", 8)
            c.drawString(MARGEM + 2 * mm, y, fmt_dt(v.get("data")))
            c.setFillColor(TEXTO_ESCURO)
            c.setFont("Helvetica", 9)
            c.drawString(MARGEM + 30 * mm, y, str(v.get("nome") or "—"))
            c.setStrokeColor(LINHA)
            c.setLineWidth(0.4)
            c.line(MARGEM, y - 2 * mm, MARGEM + util, y - 2 * mm)
            y -= 6.5 * mm
    else:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(MARGEM + 2 * mm, y, "Nenhuma visita assinada registrada no período.")
        y -= 6.5 * mm
    y -= 8 * mm

    # ── 4. Nossa análise (percepções) ────────────────────────────────────────
    if y < _LIMITE_RODAPE + 20 * mm:
        y = _nova_pagina(c, largura, altura)
    y = secao(c, largura, y, "4. Nossa análise")
    percepcoes = dados.get("percepcoes") or []
    if percepcoes:
        for p in percepcoes:
            linhas = quebrar_em_linhas((p.get("texto") or "").replace("\n", " "), 108)
            altura_bloco = len(linhas) * 4.4 * mm + 8 * mm
            if y - altura_bloco < _LIMITE_RODAPE:
                y = _nova_pagina(c, largura, altura)
            c.setFillColor(DOURADO_CLARO)
            c.rect(MARGEM, y - altura_bloco + 4 * mm, util, altura_bloco - 2 * mm, fill=1, stroke=0)
            c.setFillColor(colors.HexColor("#d8cb6a"))
            c.rect(MARGEM, y - altura_bloco + 4 * mm, 1.2 * mm, altura_bloco - 2 * mm, fill=1, stroke=0)
            yy = y
            c.setFillColor(TEXTO_ESCURO)
            c.setFont("Helvetica", 9)
            for linha in linhas:
                c.drawString(MARGEM + 5 * mm, yy, linha)
                yy -= 4.4 * mm
            c.setFillColor(TEXTO_CLARO)
            c.setFont("Helvetica", 7)
            c.drawString(MARGEM + 5 * mm, yy, fmt_dt(p.get("created_at")))
            y -= altura_bloco + 3 * mm
    else:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(MARGEM + 2 * mm, y, "Sem anotações da equipe neste período.")
        y -= 6.5 * mm

    # ── Footer ───────────────────────────────────────────────────────────────
    _rodape(c, largura)

    c.showPage()
    c.save()
    return buffer.getvalue()
