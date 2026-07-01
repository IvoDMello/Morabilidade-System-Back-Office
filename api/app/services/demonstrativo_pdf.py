"""Geração do demonstrativo mensal de locação em PDF.

Reproduz a regra de cobrança do exemplo "Artur Araripe" (referência do projeto):
    Total = Aluguel
          + Condomínio          (se incluir_condominio_cobranca)
          - Fundo de obra       (se incluir_fundo_obra_cobranca; despesa
                                 extraordinária — responsabilidade do proprietário)
          + IPTU / 10           (se incluir_iptu_cobranca; IPTU é anual,
                                 cobrado em 10 parcelas — padrão municipal RJ)
          + Seguro incêndio/12  (se incluir_seguro_incendio_cobranca;
                                 apólice anual diluída em 12 meses)
          + Internet            (se incluir_internet_cobranca)
          - Fundo de reserva    (sempre deduz — responsabilidade do proprietário)

Stack: ReportLab (pure-Python). Escolhido em vez de WeasyPrint porque não tem
dependências nativas (Cairo/Pango), o que evita atrito tanto no Windows
local quanto no Docker do Railway.
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

# Identidade visual e helpers compartilhados ([pdf_base]).
from app.services.pdf_base import (
    DOURADO_CLARO,
    LINHA,
    MESES_PT,
    OLIVE,
    TEXTO_CLARO,
    TEXTO_ESCURO,
    dec as _dec,
    draw_brand_footer,
    draw_brand_header,
    fmt_brl as _fmt_brl,
    fmt_data as _fmt_data,
    quebrar_em_linhas as _quebrar_em_linhas,
)
from app.services.fechamento import vencimento_no_mes


def calcular_total_demonstrativo(contrato: dict) -> Decimal:
    """Aplica a regra de composição do total a pagar."""
    total = _dec(contrato.get("aluguel_mensal"))

    if contrato.get("incluir_condominio_cobranca"):
        total += _dec(contrato.get("condominio_mensal"))

    if contrato.get("incluir_fundo_obra_cobranca"):
        # Despesa extraordinária do proprietário — deduz do valor a receber.
        total -= _dec(contrato.get("fundo_obra"))

    if contrato.get("incluir_iptu_cobranca"):
        # IPTU anual dividido em 10 parcelas mensais (regra municipal RJ).
        total += _dec(contrato.get("iptu_anual")) / Decimal("10")

    if contrato.get("incluir_seguro_incendio_cobranca"):
        # Seguro incêndio: apólice anual diluída em 12 parcelas.
        total += _dec(contrato.get("seguro_incendio_anual")) / Decimal("12")

    if contrato.get("incluir_internet_cobranca"):
        total += _dec(contrato.get("internet_mensal"))

    total -= _dec(contrato.get("fundo_reserva"))
    return total.quantize(Decimal("0.01"))


def _endereco_curto(imovel: Optional[dict]) -> str:
    """Linha curta para o título do demonstrativo."""
    if not imovel:
        return "Imóvel"
    partes = []
    for k in ("endereco", "logradouro"):
        v = imovel.get(k)
        if v:
            partes.append(str(v))
            break
    if imovel.get("numero"):
        partes.append(str(imovel["numero"]))
    if imovel.get("complemento"):
        partes.append(str(imovel["complemento"]))
    return ", ".join(partes) if partes else (imovel.get("codigo") or "Imóvel")


def gerar_demonstrativo_pdf(contrato: dict, mes_referencia: date) -> bytes:
    """Gera o PDF e devolve os bytes.

    `contrato` deve ter os campos do schema ContratoLocacaoOut (com `imovel`
    achatado em ParteResumo). `mes_referencia` define o título e o vencimento
    do demonstrativo (usa contrato['dia_vencimento']).
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4

    # ── Header olive (logo + tagline) ──────────────────────────────────────
    header_h = 36 * mm
    draw_brand_header(
        c, largura, altura,
        header_mm=36, tagline="SIMPLES, EFICIENTE E HUMANIZADA",
    )

    # ── Conteúdo ────────────────────────────────────────────────────────────
    y = altura - header_h - 18 * mm

    imovel = contrato.get("imovel") or {}
    endereco_str = _endereco_curto(imovel)

    # Título empilhado em 2 linhas: "Demonstrativo Mensal" em cima, endereço
    # embaixo. Antes era uma linha só "Demonstrativo Mensal — <endereço>" que
    # estourava a página em endereços longos (ex.: Rua + número + apto + bairro).
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(15 * mm, y, "Demonstrativo Mensal")
    y -= 8 * mm

    # Auto-fit do endereço — começa em 14pt e reduz 1pt por vez até caber
    # na largura útil. Piso em 9pt; se ainda assim não couber (caso patológico),
    # quebra em palavras.
    largura_util = largura - 30 * mm
    endereco_size = 14
    while (
        endereco_size > 9
        and pdfmetrics.stringWidth(endereco_str, "Helvetica", endereco_size) > largura_util
    ):
        endereco_size -= 1

    c.setFillColor(TEXTO_ESCURO)
    if pdfmetrics.stringWidth(endereco_str, "Helvetica", endereco_size) <= largura_util:
        c.setFont("Helvetica", endereco_size)
        c.drawString(15 * mm, y, endereco_str)
        y -= 7 * mm
    else:
        # Endereço extremamente longo — quebra em até 2 linhas a 11pt.
        c.setFont("Helvetica", 11)
        linhas_end = _quebrar_em_linhas(endereco_str, 70)[:2]
        for linha in linhas_end:
            c.drawString(15 * mm, y, linha)
            y -= 6 * mm
        y -= 1 * mm

    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica", 12)
    c.drawString(15 * mm, y,
                 f"Competência: {MESES_PT[mes_referencia.month - 1]} de {mes_referencia.year}")
    y -= 16 * mm

    # ── Tabela de itens ────────────────────────────────────────────────────
    incluir_cond = bool(contrato.get("incluir_condominio_cobranca"))
    incluir_fobra = bool(contrato.get("incluir_fundo_obra_cobranca"))
    incluir_iptu = bool(contrato.get("incluir_iptu_cobranca"))
    incluir_seguro = bool(contrato.get("incluir_seguro_incendio_cobranca"))
    incluir_internet = bool(contrato.get("incluir_internet_cobranca"))
    fres = _dec(contrato.get("fundo_reserva"))

    linhas: list[tuple[str, Decimal, bool]] = []  # (label, valor, é_deducao)
    linhas.append(("Aluguel mensal", _dec(contrato.get("aluguel_mensal")), False))
    if incluir_cond:
        linhas.append(("Condomínio (ordinário)", _dec(contrato.get("condominio_mensal")), False))
    if incluir_fobra:
        linhas.append(("Fundo de obra (dedução)", _dec(contrato.get("fundo_obra")), True))
    if incluir_iptu:
        iptu_mes = _dec(contrato.get("iptu_anual")) / Decimal("10")
        # Parcela do IPTU = mês de referência (Jan=1/10 ... Out=10/10).
        # Nov/Dez ficam fora do calendário municipal RJ — clampa em 10 para
        # não exibir "11/10" caso o admin gere demonstrativo desses meses.
        parcela_iptu = min(mes_referencia.month, 10)
        linhas.append((f"IPTU ({parcela_iptu}/10 do anual)", iptu_mes, False))
    if incluir_seguro:
        seg_mes = _dec(contrato.get("seguro_incendio_anual")) / Decimal("12")
        linhas.append(("Seguro incêndio (1/12 do anual)", seg_mes, False))
    if incluir_internet:
        linhas.append(("Internet", _dec(contrato.get("internet_mensal")), False))
    if fres > 0:
        linhas.append(("Fundo de reserva (dedução)", fres, True))

    tabela_x = 15 * mm
    tabela_w = largura - 30 * mm
    linha_h = 11 * mm

    # Borda externa
    altura_tabela = linha_h * (len(linhas) + 2)  # cabeçalho + linhas + total
    c.setStrokeColor(LINHA)
    c.setLineWidth(0.5)
    c.rect(tabela_x, y - altura_tabela, tabela_w, altura_tabela, fill=0, stroke=1)

    # Cabeçalho
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.rect(tabela_x, y - linha_h, tabela_w, linha_h, fill=1, stroke=0)
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(tabela_x + 5 * mm, y - linha_h + 4 * mm, "ITEM")
    c.drawRightString(tabela_x + tabela_w - 5 * mm, y - linha_h + 4 * mm, "VALOR")
    y -= linha_h

    # Linhas
    c.setFont("Helvetica", 12)
    for label, valor, deducao in linhas:
        c.setFillColor(TEXTO_ESCURO)
        c.drawString(tabela_x + 5 * mm, y - linha_h + 4 * mm, label)
        c.setFillColor(colors.HexColor("#dc2626") if deducao else TEXTO_ESCURO)
        prefixo = "− " if deducao else ""
        c.drawRightString(tabela_x + tabela_w - 5 * mm, y - linha_h + 4 * mm,
                          prefixo + _fmt_brl(valor))
        # Linha divisória
        c.setStrokeColor(LINHA)
        c.line(tabela_x, y - linha_h, tabela_x + tabela_w, y - linha_h)
        y -= linha_h

    # Total destacado (dourado claro)
    total = calcular_total_demonstrativo(contrato)
    c.setFillColor(DOURADO_CLARO)
    c.rect(tabela_x, y - linha_h, tabela_w, linha_h, fill=1, stroke=0)
    c.setFillColor(OLIVE)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(tabela_x + 5 * mm, y - linha_h + 4 * mm, "TOTAL A PAGAR")
    c.drawRightString(tabela_x + tabela_w - 5 * mm, y - linha_h + 4 * mm, _fmt_brl(total))
    y -= linha_h + 14 * mm

    # ── Vencimento + PIX ───────────────────────────────────────────────────
    vencimento = vencimento_no_mes(contrato.get("dia_vencimento"), mes_referencia)

    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(15 * mm, y, f"Vencimento: {_fmt_data(vencimento)}")
    y -= 9 * mm

    pix = contrato.get("dados_cobranca_pix") or ""
    if pix:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica", 12)
        c.drawString(15 * mm, y, "Pagamento via PIX:")
        c.setFillColor(OLIVE)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(15 * mm + 42 * mm, y, pix)
        y -= 8 * mm

    # Dados bancários (TED/DOC) — só renderiza os campos preenchidos.
    banco = (contrato.get("dados_cobranca_banco") or "").strip()
    agencia = (contrato.get("dados_cobranca_agencia") or "").strip()
    conta = (contrato.get("dados_cobranca_conta") or "").strip()
    if banco or agencia or conta:
        for label, valor in (("Banco:", banco), ("Agência:", agencia), ("Conta:", conta)):
            if not valor:
                continue
            c.setFillColor(TEXTO_CLARO)
            c.setFont("Helvetica", 12)
            c.drawString(15 * mm, y, label)
            c.setFillColor(OLIVE)
            c.setFont("Helvetica-Bold", 12)
            c.drawString(15 * mm + 22 * mm, y, valor)
            y -= 7 * mm
        y -= 5 * mm
    elif pix:
        y -= 6 * mm
    else:
        y -= 6 * mm

    # ── Observações do contrato ────────────────────────────────────────────
    obs = (contrato.get("observacoes_demonstrativo") or "").strip()
    if obs:
        c.setStrokeColor(LINHA)
        c.line(15 * mm, y, largura - 15 * mm, y)
        y -= 8 * mm
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(15 * mm, y, "OBSERVAÇÕES")
        y -= 7 * mm
        c.setFillColor(TEXTO_ESCURO)
        c.setFont("Helvetica", 12)
        for linha in _quebrar_em_linhas(obs, 80):
            c.drawString(15 * mm, y, linha)
            y -= 6 * mm
        y -= 6 * mm

    # ── Texto legal fixo ───────────────────────────────────────────────────
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica-Oblique", 11)
    legal = (
        "Em caso de inadimplemento (Cláusula 4.3 do contrato de locação): multa "
        "moratória de 10% do total devido + juros de 1% ao mês."
    )
    for linha in _quebrar_em_linhas(legal, 80):
        c.drawString(15 * mm, y, linha)
        y -= 6 * mm

    # ── Footer olive ───────────────────────────────────────────────────────
    draw_brand_footer(c, largura)

    c.showPage()
    c.save()
    return buffer.getvalue()
