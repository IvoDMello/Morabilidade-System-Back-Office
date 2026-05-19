"""Geração do demonstrativo mensal de locação em PDF.

Reproduz a regra de cobrança do exemplo "Artur Araripe" (referência do projeto):
    Total = Aluguel
          + Condomínio          (se incluir_condominio_cobranca)
          + Fundo de obra       (se incluir_fundo_obra_cobranca)
          + IPTU / 10           (se incluir_iptu_cobranca; IPTU é anual,
                                 cobrado em 10 parcelas — padrão municipal RJ)
          + Seguro incêndio/12  (se incluir_seguro_incendio_cobranca;
                                 apólice anual diluída em 12 meses)
          - Fundo de reserva    (sempre deduz — responsabilidade do proprietário)

Stack: ReportLab (pure-Python). Escolhido em vez de WeasyPrint porque não tem
dependências nativas (Cairo/Pango), o que evita atrito tanto no Windows
local quanto no Docker do Railway.
"""
from __future__ import annotations

import io
import os
from datetime import date
from decimal import Decimal
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# Identidade visual Morabilidade
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

_LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo.png")


def _dec(v) -> Decimal:
    """Aceita None, str, float, int, Decimal — devolve Decimal."""
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


def calcular_total_demonstrativo(contrato: dict) -> Decimal:
    """Aplica a regra de composição do total a pagar."""
    total = _dec(contrato.get("aluguel_mensal"))

    if contrato.get("incluir_condominio_cobranca"):
        total += _dec(contrato.get("condominio_mensal"))

    if contrato.get("incluir_fundo_obra_cobranca"):
        total += _dec(contrato.get("fundo_obra"))

    if contrato.get("incluir_iptu_cobranca"):
        # IPTU anual dividido em 10 parcelas mensais (regra municipal RJ).
        total += _dec(contrato.get("iptu_anual")) / Decimal("10")

    if contrato.get("incluir_seguro_incendio_cobranca"):
        # Seguro incêndio: apólice anual diluída em 12 parcelas.
        total += _dec(contrato.get("seguro_incendio_anual")) / Decimal("12")

    total -= _dec(contrato.get("fundo_reserva"))
    return total.quantize(Decimal("0.01"))


def _fmt_brl(valor: Decimal | float | int) -> str:
    """Formata como R$ 1.234,56 (padrão BR)."""
    v = float(valor)
    # Truque clássico: format en-US e depois swap , <-> .
    s = f"{v:,.2f}"
    return "R$ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_data(d: date) -> str:
    return d.strftime("%d/%m/%Y")


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
    c.setFillColor(OLIVE)
    c.rect(0, altura - header_h, largura, header_h, fill=1, stroke=0)

    # Logo (se o arquivo existe). Mantemos o demonstrativo robusto a logo
    # ausente — em testes ou ambientes mínimos não trava.
    if os.path.exists(_LOGO_PATH):
        try:
            c.drawImage(
                _LOGO_PATH,
                15 * mm, altura - header_h + 4 * mm,
                width=64 * mm, height=28 * mm,
                preserveAspectRatio=True, mask="auto",
            )
        except Exception:
            # Falha de imagem nunca deve impedir a emissão.
            pass

    # Tagline à direita
    c.setFillColor(DOURADO)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(largura - 15 * mm, altura - header_h / 2 - 1 * mm,
                      "SIMPLES, EFICIENTE E HUMANIZADA")

    # ── Conteúdo ────────────────────────────────────────────────────────────
    y = altura - header_h - 18 * mm

    imovel = contrato.get("imovel") or {}
    titulo = f"Demonstrativo Mensal — {_endereco_curto(imovel)}"

    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(15 * mm, y, titulo)
    y -= 8 * mm

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
    fres = _dec(contrato.get("fundo_reserva"))

    linhas: list[tuple[str, Decimal, bool]] = []  # (label, valor, é_deducao)
    linhas.append(("Aluguel mensal", _dec(contrato.get("aluguel_mensal")), False))
    if incluir_cond:
        linhas.append(("Condomínio (ordinário)", _dec(contrato.get("condominio_mensal")), False))
    if incluir_fobra:
        linhas.append(("Fundo de obra", _dec(contrato.get("fundo_obra")), False))
    if incluir_iptu:
        iptu_mes = _dec(contrato.get("iptu_anual")) / Decimal("10")
        linhas.append(("IPTU (1/10 do anual)", iptu_mes, False))
    if incluir_seguro:
        seg_mes = _dec(contrato.get("seguro_incendio_anual")) / Decimal("12")
        linhas.append(("Seguro incêndio (1/12 do anual)", seg_mes, False))
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
    dia = min(int(contrato.get("dia_vencimento") or 5),
              _ultimo_dia_do_mes(mes_referencia))
    vencimento = date(mes_referencia.year, mes_referencia.month, dia)

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
        y -= 14 * mm
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
    footer_h = 16 * mm
    c.setFillColor(OLIVE)
    c.rect(0, 0, largura, footer_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 11)
    c.drawString(15 * mm, footer_h / 2 - 2 * mm, "www.morabilidade.com")
    c.drawRightString(largura - 15 * mm, footer_h / 2 - 2 * mm, "(21) 99772-9990")

    c.showPage()
    c.save()
    return buffer.getvalue()


def _quebrar_em_linhas(texto: str, max_chars: int) -> list[str]:
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


def _ultimo_dia_do_mes(d: date) -> int:
    if d.month == 12:
        prox = date(d.year + 1, 1, 1)
    else:
        prox = date(d.year, d.month + 1, 1)
    from datetime import timedelta
    return (prox - timedelta(days=1)).day
