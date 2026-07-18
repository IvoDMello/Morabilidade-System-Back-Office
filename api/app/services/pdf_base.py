"""Helpers compartilhados de geração de PDF (ReportLab).

Centraliza a identidade visual Morabilidade (cores, header/footer, logo) e os
formatadores BR usados pelos documentos do sistema, demonstrativo de locação
([demonstrativo_pdf]) e ficha de visita ([ficha_visita_pdf]).

Stack: ReportLab puro (sem Cairo/Pango), por rodar igual no Windows local e no
Docker do Railway.
"""
from __future__ import annotations

import base64
import io
import logging
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# ── Identidade visual Morabilidade ───────────────────────────────────────────
OLIVE = colors.HexColor("#585a4f")
DOURADO = colors.HexColor("#d8cb6a")
DOURADO_CLARO = colors.HexColor("#fdfaef")
TEXTO_ESCURO = colors.HexColor("#1f2937")
TEXTO_CLARO = colors.HexColor("#64748b")
LINHA = colors.HexColor("#e2e8f0")

# Fuso usado na apresentação de datas/horas. O banco grava sempre em UTC; aqui
# convertemos só na hora de imprimir, pra trilha de auditoria bater com o
# horário local de quem assinou. Se o ambiente não tiver a base IANA (Windows
# sem o pacote tzdata), caímos num offset fixo de -3h, correto pro Brasil hoje,
# que não observa mais horário de verão, pra nunca quebrar a geração do PDF.
try:
    TZ_BR = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    TZ_BR = timezone(timedelta(hours=-3))
    logger.warning(
        "tzdata indisponível (ZoneInfo 'America/Sao_Paulo' não encontrado); "
        "usando offset fixo UTC-3. As horas ficam corretas enquanto o Brasil "
        "não voltar a ter horário de verão. Instale o pacote 'tzdata'."
    )

# Rótulo do fuso exibido na trilha de auditoria, pra hora não ficar ambígua.
TZ_BR_LABEL = "horário de Brasília"

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "logo.png")


# ── Formatadores ─────────────────────────────────────────────────────────────

def dec(v) -> Decimal:
    """Aceita None, str, float, int, Decimal, devolve Decimal."""
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

    Mantém o documento robusto a logo ausente, em testes ou ambientes mínimos
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


# ── Componentes de formulário (compartilhados por ficha e autorização) ───────

MARGEM = 15 * mm


def secao(c: canvas.Canvas, largura: float, y: float, titulo: str) -> float:
    """Faixa olive fina com o título da seção. Devolve o Y abaixo dela."""
    barra_h = 7 * mm
    c.setFillColor(OLIVE)
    c.rect(MARGEM, y - barra_h, largura - 2 * MARGEM, barra_h, fill=1, stroke=0)
    c.setFillColor(DOURADO)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(MARGEM + 3 * mm, y - barra_h + 2 * mm, titulo.upper())
    return y - barra_h - 6 * mm


def campo(c: canvas.Canvas, x: float, y: float, largura: float, label: str, valor: str) -> None:
    """Rótulo pequeno em cima + valor + linha de base (estilo formulário)."""
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica", 7)
    c.drawString(x, y, label.upper())
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica-Bold", 10)
    valor = valor or "-"
    # Trunca para não invadir o campo vizinho.
    while valor != "-" and c.stringWidth(valor, "Helvetica-Bold", 10) > largura - 2 and len(valor) > 4:
        valor = valor[:-2]
    c.drawString(x, y - 4.5 * mm, valor)
    c.setStrokeColor(LINHA)
    c.setLineWidth(0.5)
    c.line(x, y - 6 * mm, x + largura, y - 6 * mm)


def desenhar_qr(c: canvas.Canvas, x: float, y: float, lado: float, conteudo: str) -> None:
    """QR code (nativo do ReportLab, sem dependência extra)."""
    try:
        from reportlab.graphics.barcode import qr
        from reportlab.graphics.shapes import Drawing
        from reportlab.graphics import renderPDF

        widget = qr.QrCodeWidget(conteudo)
        bounds = widget.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        d = Drawing(lado, lado, transform=[lado / w, 0, 0, lado / h, 0, 0])
        d.add(widget)
        renderPDF.draw(d, c, x, y)
    except Exception:
        # QR é enfeite/rastreio, nunca deve impedir a emissão.
        pass


def desenhar_assinatura_png(c: canvas.Canvas, data_url: str, x: float, y: float, w: float, h: float) -> bool:
    """Desenha a imagem da assinatura a partir de um data URL base64. Devolve
    True se conseguiu desenhar."""
    if not data_url:
        return False
    try:
        if "," in data_url:
            data_url = data_url.split(",", 1)[1]
        raw = base64.b64decode(data_url)
        img = ImageReader(io.BytesIO(raw))
        c.drawImage(img, x, y, width=w, height=h, preserveAspectRatio=True, mask="auto")
        return True
    except Exception:
        return False


def fmt_dt(valor, com_hora: bool = False) -> str:
    """Formata um ISO timestamp/string para DD/MM/AAAA (+ hora opcional)."""
    if not valor:
        return "-"
    if isinstance(valor, datetime):
        dt = valor
    else:
        try:
            dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        except ValueError:
            return str(valor)[:10]
    # Converte pro fuso do Brasil quando o valor é "aware" (timestamptz vindo do
    # banco). Isso acerta tanto a hora quanto a data, perto da meia-noite o dia
    # em UTC e no Brasil podem diferir. Strings só-data ("2026-06-18") são naive
    # e ficam como estão.
    if dt.tzinfo is not None:
        dt = dt.astimezone(TZ_BR)
    return dt.strftime("%d/%m/%Y %H:%M") if com_hora else dt.strftime("%d/%m/%Y")


def bloco_trilha(
    c: canvas.Canvas, largura: float, y: float, *,
    signatario_nome: str, cpf: str, assinada_em, ip: str, geo: str, doc_hash: str,
) -> None:
    """Caixa com a prova da assinatura eletrônica simples (IP, hora, geo, hash).
    Usada tanto pela ficha de visita quanto pela autorização."""
    linhas = [
        ("Assinado eletronicamente por", f"{signatario_nome}  ·  CPF {cpf or '-'}"),
        (f"Data/hora ({TZ_BR_LABEL})", fmt_dt(assinada_em, com_hora=True)),
        ("IP de origem", ip or "-"),
        ("Geolocalização", geo or "não informada"),
        ("Hash do documento (SHA-256)", doc_hash or "-"),
    ]
    altura_caixa = 6 * mm + len(linhas) * 4.4 * mm + 5 * mm
    c.setFillColor(colors.HexColor("#fafafa"))
    c.setStrokeColor(LINHA)
    c.setLineWidth(0.5)
    c.rect(MARGEM, y - altura_caixa, largura - 2 * MARGEM, altura_caixa, fill=1, stroke=1)

    yy = y - 5 * mm
    c.setFillColor(OLIVE)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(MARGEM + 3 * mm, yy, "TRILHA DE AUDITORIA: ASSINATURA ELETRÔNICA")
    yy -= 5 * mm
    for label, valor in linhas:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica", 7)
        c.drawString(MARGEM + 3 * mm, yy, f"{label}:")
        c.setFillColor(TEXTO_ESCURO)
        c.setFont("Helvetica", 7)
        c.drawString(MARGEM + 48 * mm, yy, str(valor))
        yy -= 4.4 * mm

    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica-Oblique", 6.5)
    c.drawString(MARGEM + 3 * mm, yy,
                 "Assinatura eletrônica nos termos do art. 107 do Código Civil e da Lei nº 14.063/2020.")
