"""Geração da Ficha / Termo de Visita a Imóvel em PDF (ReportLab).

Dois modos a partir da mesma função:
- preview (assinada=False): documento em branco para conferência.
- assinada (assinada=True): com os dados do visitante, a imagem da assinatura e
  o bloco de trilha de auditoria (IP, data/hora, geolocalização e hash).

A cláusula assinada é versionada e gravada na própria ficha (snapshot) — ver
`montar_clausula` e a coluna `clausula_texto` na migration 034. Componentes de
layout (header/footer/seção/campo/trilha) vivem em [pdf_base].
"""
from __future__ import annotations

import io

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

_EXTENSO = {
    6: "seis", 12: "doze", 18: "dezoito", 24: "vinte e quatro", 36: "trinta e seis",
}


def montar_clausula(prazo_meses: int) -> str:
    """Texto integral da declaração do visitante (versão `CLAUSULA_VERSAO`).

    Gravado como snapshot na ficha no momento da geração — não deve ser alterado
    retroativamente para fichas já existentes (integridade probatória)."""
    extenso = _EXTENSO.get(prazo_meses)
    prazo_txt = f"{prazo_meses} ({extenso})" if extenso else str(prazo_meses)
    return (
        "Declaro, para os devidos fins, que tomei conhecimento e visitei pela "
        "primeira vez o imóvel acima identificado por intermédio da MORABILIDADE "
        "e do corretor responsável indicado nesta ficha. Comprometo-me a conduzir "
        "qualquer proposta, negociação, compra, locação ou intermediação relativa "
        "a este imóvel exclusivamente por meio da Morabilidade.\n\n"
        "Reconheço que, caso a aquisição ou locação deste imóvel venha a ocorrer, "
        "direta ou indiretamente, com o proprietário, com terceiros por mim "
        f"indicados, ou por outra imobiliária, no prazo de {prazo_txt} meses "
        "contados desta visita, será devida a comissão de corretagem à "
        "Morabilidade, por ter sido ela a causa eficiente da aproximação das "
        "partes, nos termos dos arts. 725 e 727 do Código Civil (Lei nº "
        "10.406/2002).\n\n"
        "Declaro ainda que as informações prestadas são verdadeiras e autorizo o "
        "tratamento dos meus dados pessoais para fins de cadastro e do processo "
        "de intermediação, nos termos da Lei nº 13.709/2018 (LGPD)."
    )


def gerar_ficha_visita_pdf(ficha: dict, assinada: bool = False) -> bytes:
    """Gera o PDF da ficha de visita e devolve os bytes."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    util = largura - 2 * MARGEM

    y = draw_brand_header(
        c, largura, altura,
        header_mm=30, titulo="FICHA / TERMO DE VISITA",
    )

    # ── Linha de identificação + QR ──────────────────────────────────────────
    y -= 12 * mm
    codigo = ficha.get("imovel_codigo") or "—"
    ficha_num = (ficha.get("id") or "").replace("-", "")[:8].upper() or "—"
    criada = fmt_dt(ficha.get("created_at"))

    campo(c, MARGEM, y, 50 * mm, "Ficha nº", ficha_num)
    campo(c, MARGEM + 56 * mm, y, 45 * mm, "Data da visita", criada)
    campo(c, MARGEM + 106 * mm, y, 30 * mm, "Código / ref.", codigo)

    # QR no canto superior direito do conteúdo, apontando pro imóvel no site.
    # Alinhado pelo topo com a linha de campos (origem do QR = canto inferior).
    qr_url = f"{settings.site_url.rstrip('/')}/imoveis/{codigo}" if codigo != "—" else settings.site_url
    desenhar_qr(c, largura - MARGEM - 16 * mm, y - 14 * mm, 16 * mm, qr_url)

    y -= 20 * mm

    # ── 1. Dados do imóvel ───────────────────────────────────────────────────
    y = secao(c, largura, y, "1. Dados do imóvel")
    campo(c, MARGEM, y, util, "Endereço completo", ficha.get("imovel_endereco") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, 60 * mm, "Bairro", ficha.get("imovel_bairro") or "—")
    campo(c, MARGEM + 66 * mm, y, 50 * mm, "Cidade / UF", ficha.get("imovel_cidade") or "—")
    valor = fmt_brl(ficha["imovel_valor"]) if ficha.get("imovel_valor") is not None else "—"
    campo(c, MARGEM + 122 * mm, y, util - 122 * mm, "Valor anunciado", valor)
    y -= 12 * mm
    prop = ficha.get("proprietario_nome") or "Imóvel sob intermediação da Morabilidade"
    campo(c, MARGEM, y, util, "Proprietário", prop)
    y -= 14 * mm

    # ── 2. Dados do visitante ────────────────────────────────────────────────
    y = secao(c, largura, y, "2. Dados do visitante")
    campo(c, MARGEM, y, util, "Nome completo", ficha.get("visitante_nome") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, 55 * mm, "CPF", ficha.get("visitante_cpf") or "—")
    campo(c, MARGEM + 61 * mm, y, 45 * mm, "RG", ficha.get("visitante_rg") or "—")
    campo(c, MARGEM + 111 * mm, y, util - 111 * mm, "Telefone / WhatsApp", ficha.get("visitante_telefone") or "—")
    y -= 12 * mm
    campo(c, MARGEM, y, util, "E-mail", ficha.get("visitante_email") or "—")
    y -= 14 * mm

    # ── 3. Corretor responsável ──────────────────────────────────────────────
    y = secao(c, largura, y, "3. Corretor responsável")
    if ficha.get("ocultar_creci"):
        campo(c, MARGEM, y, util, "Nome do corretor", ficha.get("corretor_nome") or "—")
    else:
        campo(c, MARGEM, y, 110 * mm, "Nome do corretor", ficha.get("corretor_nome") or "—")
        campo(c, MARGEM + 116 * mm, y, util - 116 * mm, "CRECI nº",
              ficha.get("corretor_creci") or settings.empresa_creci_corretor)
    y -= 16 * mm

    # ── 4. Declaração ────────────────────────────────────────────────────────
    y = secao(c, largura, y, "4. Declaração do visitante")
    c.setFillColor(TEXTO_ESCURO)
    c.setFont("Helvetica", 8.5)
    clausula = ficha.get("clausula_texto") or montar_clausula(int(ficha.get("prazo_meses") or 12))
    for paragrafo in clausula.split("\n\n"):
        for linha in quebrar_em_linhas(paragrafo, 108):
            c.drawString(MARGEM, y, linha)
            y -= 4.4 * mm
        y -= 2 * mm
    y -= 4 * mm

    # ── Assinaturas ──────────────────────────────────────────────────────────
    col_w = (util - 10 * mm) / 2
    base_assinatura = y - 14 * mm

    if assinada:
        desenhar_assinatura_png(
            c, ficha.get("assinante_assinatura_png") or "",
            MARGEM, base_assinatura, col_w, 14 * mm,
        )
    c.setStrokeColor(TEXTO_ESCURO)
    c.setLineWidth(0.7)
    c.line(MARGEM, base_assinatura, MARGEM + col_w, base_assinatura)
    c.line(MARGEM + col_w + 10 * mm, base_assinatura, MARGEM + 2 * col_w + 10 * mm, base_assinatura)

    c.setFillColor(TEXTO_CLARO)
    c.setFont("Helvetica", 8)
    c.drawCentredString(MARGEM + col_w / 2, base_assinatura - 4 * mm, "VISITANTE — Assinatura e CPF")
    c.drawCentredString(MARGEM + col_w + 10 * mm + col_w / 2, base_assinatura - 4 * mm,
                        "MORABILIDADE / CORRETOR — Assinatura"
                        if ficha.get("ocultar_creci")
                        else "MORABILIDADE / CORRETOR — Assinatura e CRECI")

    # ── Bloco de trilha de auditoria (só assinada) ───────────────────────────
    if assinada:
        bloco_trilha(
            c, largura, base_assinatura - 12 * mm,
            signatario_nome=ficha.get("visitante_nome", ""),
            cpf=ficha.get("assinante_cpf_confirmado") or ficha.get("visitante_cpf") or "—",
            assinada_em=ficha.get("assinada_em"),
            ip=ficha.get("assinante_ip"),
            geo=ficha.get("assinante_geo"),
            doc_hash=ficha.get("documento_hash"),
        )
    else:
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Oblique", 8)
        c.drawString(MARGEM, base_assinatura - 12 * mm,
                     "Documento aguardando assinatura eletrônica do visitante.")

    # ── Footer ───────────────────────────────────────────────────────────────
    rodape_esq = " · ".join(filter(None, [
        settings.empresa_creci_juridico or settings.empresa_creci_corretor,
        f"CNPJ {settings.empresa_cnpj}" if settings.empresa_cnpj else None,
    ])) or "MORABILIDADE — Intermediação imobiliária"
    draw_brand_footer(c, largura, esquerda=rodape_esq, direita=settings.empresa_telefone)

    c.showPage()
    c.save()
    return buffer.getvalue()
