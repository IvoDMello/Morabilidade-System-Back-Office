"""Geração da Autorização de Intermediação Imobiliária em PDF (ReportLab).

Documento assinado pelo proprietário. Reaproveita os componentes de layout de
[pdf_base] (header/footer/seção/campo/trilha). A cláusula é versionada e
gravada na própria autorização (snapshot) — ver `montar_clausula_autorizacao`
e a coluna `clausula_texto` na migration 035.
"""
from __future__ import annotations

import io
from decimal import Decimal
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.config import settings
from app.services.pdf_base import (
    MARGEM,
    TEXTO_CLARO,
    TEXTO_ESCURO,
    bloco_trilha,
    campo,
    desenhar_assinatura_png,
    desenhar_qr,
    draw_brand_footer,
    draw_brand_header,
    fmt_brl,
    fmt_dt,
    quebrar_em_linhas,
    secao,
)

CLAUSULA_VERSAO = "v1"

_NEGOCIO = {"venda": "venda", "locacao": "locação", "ambos": "venda e/ou locação"}


def _fmt_pct(v) -> str:
    if v is None:
        return "—"
    d = Decimal(str(v))
    # Remove zeros à direita: 6.00 -> 6, 6.50 -> 6,5
    txt = format(d.normalize(), "f").replace(".", ",")
    return f"{txt}%"


def montar_clausula_autorizacao(
    *,
    tipo_negocio: str,
    valor_autorizado: Optional[Decimal],
    exclusiva: bool,
    comissao_venda_pct: Optional[Decimal],
    comissao_locacao_desc: Optional[str],
    prazo_dias: int,
) -> str:
    """Texto integral da autorização (versão `CLAUSULA_VERSAO`)."""
    negocio = _NEGOCIO.get(tipo_negocio, "negociação")

    intro = (
        "O(A) PROPRIETÁRIO(A) acima qualificado(a), na qualidade de legítimo(a) "
        "titular ou seu(sua) representante, AUTORIZA a MORABILIDADE a promover e "
        f"intermediar a {negocio} do imóvel acima identificado"
    )
    if valor_autorizado is not None:
        intro += f", pelo valor de {fmt_brl(valor_autorizado)}"
    intro += "."

    # Comissão conforme o tipo de negócio.
    partes_com = []
    if tipo_negocio in ("venda", "ambos"):
        partes_com.append(
            f"o percentual de {_fmt_pct(comissao_venda_pct)} sobre o valor efetivo da venda"
        )
    if tipo_negocio in ("locacao", "ambos"):
        partes_com.append(
            f"{comissao_locacao_desc or 'equivalente ao primeiro aluguel'}, no caso de locação"
        )
    comissao = (
        "O proprietário compromete-se a pagar à Morabilidade, a título de comissão "
        "de corretagem, " + " e ".join(partes_com) + ", nos termos dos arts. 722 a "
        "729 do Código Civil (Lei nº 10.406/2002)."
    )

    if exclusiva:
        exclusividade = (
            f"A presente autorização é concedida COM EXCLUSIVIDADE pelo prazo de "
            f"{prazo_dias} dias. Nos termos do art. 726 do Código Civil, durante a "
            "vigência a comissão integral será devida à Morabilidade ainda que o "
            "negócio seja concluído diretamente pelo proprietário ou por terceiros."
        )
    else:
        exclusividade = (
            f"A presente autorização é concedida SEM EXCLUSIVIDADE pelo prazo de "
            f"{prazo_dias} dias. A comissão será devida quando a Morabilidade for a "
            "causa eficiente da aproximação que resultar no negócio (arts. 725 e 727 "
            "do Código Civil)."
        )

    declaracoes = (
        "O proprietário declara que o imóvel se encontra livre de ônus, dívidas e "
        "litígios que impeçam a sua negociação, que as informações prestadas são "
        "verdadeiras, e autoriza o tratamento dos seus dados pessoais para os fins "
        "desta intermediação, nos termos da Lei nº 13.709/2018 (LGPD)."
    )

    return f"{intro}\n\n{comissao}\n\n{exclusividade}\n\n{declaracoes}"


def gerar_autorizacao_pdf(auth: dict, assinada: bool = False) -> bytes:
    """Gera o PDF da autorização de intermediação e devolve os bytes."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    util = largura - 2 * MARGEM

    y = draw_brand_header(
        c, largura, altura,
        header_mm=30, titulo="AUTORIZAÇÃO DE INTERMEDIAÇÃO",
    )

    # ── Identificação + QR ───────────────────────────────────────────────────
    y -= 12 * mm
    codigo = auth.get("imovel_codigo") or "—"
    num = (auth.get("id") or "").replace("-", "")[:8].upper() or "—"
    criada = fmt_dt(auth.get("created_at"))

    campo(c, MARGEM, y, 50 * mm, "Autorização nº", num)
    campo(c, MARGEM + 56 * mm, y, 45 * mm, "Data", criada)
    campo(c, MARGEM + 106 * mm, y, 30 * mm, "Código / ref.", codigo)
    qr_url = f"{settings.site_url.rstrip('/')}/imoveis/{codigo}" if codigo != "—" else settings.site_url
    desenhar_qr(c, largura - MARGEM - 20 * mm, y - 18 * mm, 18 * mm, qr_url)
    y -= 14 * mm

    # ── 1. Imóvel ────────────────────────────────────────────────────────────
    y = secao(c, largura, y, "1. Imóvel")
    campo(c, MARGEM, y, util, "Endereço completo", auth.get("imovel_endereco") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, 55 * mm, "Bairro", auth.get("imovel_bairro") or "—")
    campo(c, MARGEM + 61 * mm, y, 50 * mm, "Cidade / UF", auth.get("imovel_cidade") or "—")
    campo(c, MARGEM + 116 * mm, y, util - 116 * mm, "Matrícula / RGI", auth.get("imovel_matricula") or "—")
    y -= 14 * mm

    # ── 2. Proprietário ──────────────────────────────────────────────────────
    y = secao(c, largura, y, "2. Proprietário")
    campo(c, MARGEM, y, util, "Nome completo", auth.get("proprietario_nome") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, 55 * mm, "CPF / CNPJ", auth.get("proprietario_cpf") or "—")
    campo(c, MARGEM + 61 * mm, y, util - 61 * mm, "Telefone / WhatsApp", auth.get("proprietario_telefone") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, 70 * mm, "E-mail", auth.get("proprietario_email") or "—")
    campo(c, MARGEM + 76 * mm, y, util - 76 * mm, "Endereço", auth.get("proprietario_endereco") or "—")
    y -= 14 * mm

    # ── 3. Condições da intermediação ────────────────────────────────────────
    y = secao(c, largura, y, "3. Condições da intermediação")
    negocio_lbl = _NEGOCIO.get(auth.get("tipo_negocio", ""), "—").capitalize()
    valor_lbl = fmt_brl(auth["valor_autorizado"]) if auth.get("valor_autorizado") is not None else "—"
    campo(c, MARGEM, y, 50 * mm, "Negócio", negocio_lbl)
    campo(c, MARGEM + 56 * mm, y, 50 * mm, "Valor autorizado", valor_lbl)
    campo(c, MARGEM + 112 * mm, y, util - 112 * mm, "Exclusividade",
          "Com exclusividade" if auth.get("exclusiva") else "Sem exclusividade")
    y -= 12 * mm
    campo(c, MARGEM, y, 55 * mm, "Comissão (venda)", _fmt_pct(auth.get("comissao_venda_pct")))
    campo(c, MARGEM + 61 * mm, y, 60 * mm, "Comissão (locação)", auth.get("comissao_locacao_desc") or "—")
    campo(c, MARGEM + 126 * mm, y, util - 126 * mm, "Prazo", f"{auth.get('prazo_dias') or '—'} dias")
    y -= 14 * mm

    # ── 4. Autorização e declarações ─────────────────────────────────────────
    y = secao(c, largura, y, "4. Autorização e declarações")
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica", 8.5)
    clausula = auth.get("clausula_texto") or montar_clausula_autorizacao(
        tipo_negocio=auth.get("tipo_negocio", "venda"),
        valor_autorizado=auth.get("valor_autorizado"),
        exclusiva=bool(auth.get("exclusiva")),
        comissao_venda_pct=auth.get("comissao_venda_pct"),
        comissao_locacao_desc=auth.get("comissao_locacao_desc"),
        prazo_dias=int(auth.get("prazo_dias") or 90),
    )
    for paragrafo in clausula.split("\n\n"):
        for linha in quebrar_em_linhas(paragrafo, 108):
            c.drawString(MARGEM, y, linha)
            y -= 4.4 * mm
        y -= 2 * mm
    y -= 4 * mm

    # ── Assinaturas ──────────────────────────────────────────────────────────
    col_w = (util - 10 * mm) / 2
    base = y - 14 * mm
    if assinada:
        desenhar_assinatura_png(
            c, auth.get("assinante_assinatura_png") or "",
            MARGEM, base, col_w, 14 * mm,
        )
    c.setStrokeColor(TEXTO_ESCURO)
    c.setLineWidth(0.7)
    c.line(MARGEM, base, MARGEM + col_w, base)
    c.line(MARGEM + col_w + 10 * mm, base, MARGEM + 2 * col_w + 10 * mm, base)
    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica", 8)
    c.drawCentredString(MARGEM + col_w / 2, base - 4 * mm, "PROPRIETÁRIO — Assinatura e CPF/CNPJ")
    c.drawCentredString(MARGEM + col_w + 10 * mm + col_w / 2, base - 4 * mm,
                        "MORABILIDADE / CORRETOR — Assinatura e CRECI")

    # ── Trilha (só assinada) ─────────────────────────────────────────────────
    if assinada:
        bloco_trilha(
            c, largura, base - 12 * mm,
            signatario_nome=auth.get("proprietario_nome", ""),
            cpf=auth.get("assinante_cpf_confirmado") or auth.get("proprietario_cpf") or "—",
            assinada_em=auth.get("assinada_em"),
            ip=auth.get("assinante_ip"),
            geo=auth.get("assinante_geo"),
            doc_hash=auth.get("documento_hash"),
        )
    else:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(MARGEM, base - 12 * mm,
                     "Documento aguardando assinatura eletrônica do proprietário.")

    # ── Footer ───────────────────────────────────────────────────────────────
    rodape_esq = " · ".join(filter(None, [
        settings.empresa_creci_juridico or settings.empresa_creci_corretor,
        f"CNPJ {settings.empresa_cnpj}" if settings.empresa_cnpj else None,
    ])) or "MORABILIDADE — Intermediação imobiliária"
    draw_brand_footer(c, largura, esquerda=rodape_esq, direita=settings.empresa_telefone)

    c.showPage()
    c.save()
    return buffer.getvalue()
