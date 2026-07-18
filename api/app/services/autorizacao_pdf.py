"""Geração da Autorização de Intermediação Imobiliária em PDF (ReportLab).

Documento assinado pelo(s) proprietário(s). Reaproveita os componentes de
layout de [pdf_base] (header/footer/seção/campo/trilha). A cláusula é
versionada e gravada na própria autorização (snapshot), ver
`montar_clausula_autorizacao` e a coluna `clausula_texto` na migration 035.

Com múltiplos signatários (migration 038), o documento lista todos os
proprietários, desenha uma linha de assinatura para cada um e registra a
trilha de auditoria individual. O conteúdo pagina automaticamente.
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.config import settings
from app.services.pdf_base import (
    DOURADO,
    LINHA,
    MARGEM,
    OLIVE,
    TEXTO_CLARO,
    TEXTO_ESCURO,
    TZ_BR_LABEL,
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

CLAUSULA_VERSAO = "v2"  # v2: múltiplos signatários

_NEGOCIO = {"venda": "venda", "locacao": "locação", "ambos": "venda e/ou locação"}

_RODAPE_H = 16 * mm   # faixa do draw_brand_footer
_MARGEM_INFERIOR = _RODAPE_H + 6 * mm


def _fmt_pct(v) -> str:
    if v is None:
        return "-"
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
        "O(s) PROPRIETÁRIO(S) acima qualificado(s), na qualidade de legítimo(s) "
        "titular(es) ou seu(s) representante(s), AUTORIZA(M) a MORABILIDADE a "
        f"promover e intermediar a {negocio} do imóvel acima identificado"
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
        "O(s) proprietário(s) compromete(m)-se a pagar à Morabilidade, a título de "
        "comissão de corretagem, " + " e ".join(partes_com) + ", nos termos dos arts. "
        "722 a 729 do Código Civil (Lei nº 10.406/2002)."
    )

    if exclusiva:
        exclusividade = (
            f"A presente autorização é concedida COM EXCLUSIVIDADE pelo prazo de "
            f"{prazo_dias} dias. Nos termos do art. 726 do Código Civil, durante a "
            "vigência a comissão integral será devida à Morabilidade ainda que o "
            "negócio seja concluído diretamente pelo(s) proprietário(s) ou por terceiros."
        )
    else:
        exclusividade = (
            f"A presente autorização é concedida SEM EXCLUSIVIDADE pelo prazo de "
            f"{prazo_dias} dias. A comissão será devida quando a Morabilidade for a "
            "causa eficiente da aproximação que resultar no negócio (arts. 725 e 727 "
            "do Código Civil)."
        )

    declaracoes = (
        "O(s) proprietário(s) declara(m) que o imóvel se encontra livre de ônus, "
        "dívidas e litígios que impeçam a sua negociação, que as informações "
        "prestadas são verdadeiras, e autoriza(m) o tratamento dos seus dados "
        "pessoais para os fins desta intermediação, nos termos da Lei nº 13.709/2018 "
        "(LGPD)."
    )

    return f"{intro}\n\n{comissao}\n\n{exclusividade}\n\n{declaracoes}"


def _signatarios_do_auth(auth: dict) -> list[dict]:
    """Lista de signatários; autorização antiga (sem filhos) vira lista de 1."""
    sigs = auth.get("signatarios") or []
    if sigs:
        return sorted(sigs, key=lambda s: s.get("ordem") or 0)
    return [{
        "ordem": 1,
        "nome": auth.get("proprietario_nome") or "-",
        "cpf": auth.get("proprietario_cpf"),
        "telefone": auth.get("proprietario_telefone"),
        "email": auth.get("proprietario_email"),
        "status": auth.get("status"),
        "assinada_em": auth.get("assinada_em"),
        "assinante_ip": auth.get("assinante_ip"),
        "assinante_geo": auth.get("assinante_geo"),
        "assinante_assinatura_png": auth.get("assinante_assinatura_png"),
        "assinante_cpf_confirmado": auth.get("assinante_cpf_confirmado"),
    }]


def gerar_autorizacao_pdf(auth: dict, assinada: bool = False) -> bytes:
    """Gera o PDF da autorização de intermediação e devolve os bytes."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    util = largura - 2 * MARGEM
    signatarios = _signatarios_do_auth(auth)

    rodape_esq = " · ".join(filter(None, [
        settings.empresa_creci_juridico or settings.empresa_creci_corretor,
        f"CNPJ {settings.empresa_cnpj}" if settings.empresa_cnpj else None,
    ])) or "MORABILIDADE: Intermediação imobiliária"

    def _rodape() -> None:
        draw_brand_footer(c, largura, esquerda=rodape_esq, direita=settings.empresa_telefone)

    def _nova_pagina(primeira: bool = False) -> float:
        if not primeira:
            _rodape()
            c.showPage()
        if primeira:
            topo = draw_brand_header(
                c, largura, altura,
                header_mm=30, titulo="AUTORIZAÇÃO DE INTERMEDIAÇÃO",
            )
        else:
            # Faixa fina sem logo: o logo de marca tem 28mm de altura e
            # vazaria de um header de continuação compacto.
            faixa_h = 14 * mm
            c.setFillColor(OLIVE)
            c.rect(0, altura - faixa_h, largura, faixa_h, fill=1, stroke=0)
            c.setFillColor(DOURADO)
            c.setFont("Helvetica-Bold", 11)
            c.drawRightString(largura - MARGEM, altura - faixa_h / 2 - 1.3 * mm,
                              "AUTORIZAÇÃO DE INTERMEDIAÇÃO: CONTINUAÇÃO")
            topo = altura - faixa_h
        return topo - 12 * mm

    def _garantir(y: float, precisa: float) -> float:
        """Quebra de página quando o bloco seguinte não cabe."""
        if y - precisa < _MARGEM_INFERIOR:
            return _nova_pagina()
        return y

    y = _nova_pagina(primeira=True)

    # ── Identificação + QR ───────────────────────────────────────────────────
    codigo = auth.get("imovel_codigo") or "-"
    num = (auth.get("id") or "").replace("-", "")[:8].upper() or "-"
    criada = fmt_dt(auth.get("created_at"))

    campo(c, MARGEM, y, 50 * mm, "Autorização nº", num)
    campo(c, MARGEM + 56 * mm, y, 45 * mm, "Data", criada)
    campo(c, MARGEM + 106 * mm, y, 30 * mm, "Código / ref.", codigo)
    qr_url = f"{settings.site_url.rstrip('/')}/imoveis/{codigo}" if codigo != "-" else settings.site_url
    # QR alinhado pelo topo com a linha de campos (origem = canto inferior).
    desenhar_qr(c, largura - MARGEM - 16 * mm, y - 14 * mm, 16 * mm, qr_url)
    y -= 20 * mm

    # ── 1. Imóvel ────────────────────────────────────────────────────────────
    y = _garantir(y, 45 * mm)
    y = secao(c, largura, y, "1. Imóvel")
    campo(c, MARGEM, y, util, "Endereço completo", auth.get("imovel_endereco") or "-")
    y -= 12 * mm
    campo(c, MARGEM, y, 55 * mm, "Bairro", auth.get("imovel_bairro") or "-")
    campo(c, MARGEM + 61 * mm, y, 50 * mm, "Cidade / UF", auth.get("imovel_cidade") or "-")
    campo(c, MARGEM + 116 * mm, y, util - 116 * mm, "Matrícula / RGI", auth.get("imovel_matricula") or "-")
    y -= 14 * mm

    # ── 2. Proprietário(s) ───────────────────────────────────────────────────
    titulo_prop = "2. Proprietários" if len(signatarios) > 1 else "2. Proprietário"
    y = _garantir(y, 30 * mm + 12 * mm * len(signatarios))
    y = secao(c, largura, y, titulo_prop)
    for sig in signatarios:
        y = _garantir(y, 16 * mm)
        campo(c, MARGEM, y, 78 * mm, f"Nome completo ({sig.get('ordem')}º)" if len(signatarios) > 1 else "Nome completo",
              sig.get("nome") or "-")
        campo(c, MARGEM + 84 * mm, y, 40 * mm, "CPF / CNPJ", sig.get("cpf") or "-")
        campo(c, MARGEM + 130 * mm, y, util - 130 * mm, "Telefone / WhatsApp", sig.get("telefone") or "-")
        y -= 12 * mm
    if auth.get("proprietario_endereco"):
        y = _garantir(y, 16 * mm)
        campo(c, MARGEM, y, util, "Endereço do(s) proprietário(s)", auth.get("proprietario_endereco"))
        y -= 12 * mm
    y -= 2 * mm

    # ── 3. Condições da intermediação ────────────────────────────────────────
    assinada_em_str = auth.get("assinada_em")
    tem_datas = bool(assinada_em_str)
    y = _garantir(y, (60 if tem_datas else 45) * mm)
    y = secao(c, largura, y, "3. Condições da intermediação")
    tipo = auth.get("tipo_negocio", "venda")
    negocio_lbl = _NEGOCIO.get(tipo, "-").capitalize()
    valor_lbl = fmt_brl(auth["valor_autorizado"]) if auth.get("valor_autorizado") is not None else "-"
    prazo_val = auth.get("prazo_dias") or "-"

    campo(c, MARGEM, y, 50 * mm, "Negócio", negocio_lbl)
    campo(c, MARGEM + 56 * mm, y, 50 * mm, "Valor autorizado", valor_lbl)
    campo(c, MARGEM + 112 * mm, y, util - 112 * mm, "Exclusividade",
          "Com exclusividade" if auth.get("exclusiva") else "Sem exclusividade")
    y -= 12 * mm

    if tipo == "ambos":
        campo(c, MARGEM, y, 50 * mm, "Comissão (venda)", _fmt_pct(auth.get("comissao_venda_pct")))
        campo(c, MARGEM + 56 * mm, y, 55 * mm, "Comissão (locação)", auth.get("comissao_locacao_desc") or "-")
        campo(c, MARGEM + 117 * mm, y, util - 117 * mm, "Prazo", f"{prazo_val} dias")
    elif tipo == "venda":
        campo(c, MARGEM, y, 70 * mm, "Comissão (venda)", _fmt_pct(auth.get("comissao_venda_pct")))
        campo(c, MARGEM + 76 * mm, y, util - 76 * mm, "Prazo", f"{prazo_val} dias")
    else:  # locacao
        campo(c, MARGEM, y, 100 * mm, "Comissão (locação)", auth.get("comissao_locacao_desc") or "-")
        campo(c, MARGEM + 106 * mm, y, util - 106 * mm, "Prazo", f"{prazo_val} dias")
    y -= 12 * mm

    if tem_datas:
        try:
            dt_ini = datetime.fromisoformat(str(assinada_em_str).replace("Z", "+00:00"))
            dt_fim = dt_ini + timedelta(days=int(prazo_val))
            campo(c, MARGEM, y, 80 * mm, "Início da vigência", dt_ini.strftime("%d/%m/%Y"))
            campo(c, MARGEM + 86 * mm, y, util - 86 * mm, "Término da vigência", dt_fim.strftime("%d/%m/%Y"))
            y -= 14 * mm
        except (ValueError, TypeError):
            y -= 2 * mm
    else:
        y -= 2 * mm

    # ── 4. Autorização e declarações ─────────────────────────────────────────
    y = _garantir(y, 30 * mm)
    y = secao(c, largura, y, "4. Autorização e declarações")
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
            y = _garantir(y, 6 * mm)
            c.setFillColor(TEXTO_ESCURO)
            c.setFont("Helvetica", 8.5)
            c.drawString(MARGEM, y, linha)
            y -= 4.4 * mm
        y -= 2 * mm
    y -= 4 * mm

    # ── Assinaturas: uma linha por proprietário + Morabilidade ──────────────
    col_w = (util - 10 * mm) / 2
    linha_h = 26 * mm  # espaço por fileira (traço + rótulos + respiro)

    def _linha_assinatura(x: float, base: float, rotulo: str, sublabel: str, png: str | None) -> None:
        if png:
            desenhar_assinatura_png(c, png, x, base, col_w, 14 * mm)
        c.setStrokeColor(TEXTO_ESCURO)
        c.setLineWidth(0.7)
        c.line(x, base, x + col_w, base)
        c.setFillColor(TEXTO_ESCURO)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x + col_w / 2, base - 4 * mm, rotulo[:48])
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica", 7.5)
        c.drawCentredString(x + col_w / 2, base - 7.5 * mm, sublabel)

    blocos = [
        (
            (sig.get("nome") or "-").upper(),
            f"PROPRIETÁRIO(A) {sig.get('ordem')}: Assinatura e CPF/CNPJ" if len(signatarios) > 1
            else "PROPRIETÁRIO(A): Assinatura e CPF/CNPJ",
            (sig.get("assinante_assinatura_png") if assinada else None),
        )
        for sig in signatarios
    ]
    blocos.append((
        "MORABILIDADE",
        "CORRETOR: Assinatura e CRECI",
        None,
    ))

    for i in range(0, len(blocos), 2):
        y = _garantir(y, linha_h + 14 * mm)
        base = y - 14 * mm
        _linha_assinatura(MARGEM, base, *blocos[i])
        if i + 1 < len(blocos):
            _linha_assinatura(MARGEM + col_w + 10 * mm, base, *blocos[i + 1])
        y = base - 12 * mm

    # ── Trilha de auditoria (uma entrada por signatário) ─────────────────────
    if assinada:
        assinados = [s for s in signatarios if s.get("assinada_em")]
        altura_caixa = 11 * mm + len(assinados) * 9 * mm + 9 * mm
        y = _garantir(y, altura_caixa + 4 * mm)
        topo_caixa = y
        c.setFillColor(colors.HexColor("#fafafa"))
        c.setStrokeColor(LINHA)
        c.setLineWidth(0.5)
        c.rect(MARGEM, topo_caixa - altura_caixa, util, altura_caixa, fill=1, stroke=1)

        yy = topo_caixa - 5 * mm
        c.setFillColor(OLIVE)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(MARGEM + 3 * mm, yy, "TRILHA DE AUDITORIA: ASSINATURA ELETRÔNICA")
        yy -= 5.5 * mm
        for sig in assinados:
            cpf = sig.get("assinante_cpf_confirmado") or sig.get("cpf") or "-"
            c.setFillColor(TEXTO_ESCURO)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(MARGEM + 3 * mm, yy, f"{sig.get('nome')}  ·  CPF {cpf}")
            yy -= 4 * mm
            c.setFillColor(TEXTO_CLARO)
            c.setFont("Helvetica", 7)
            detalhe = (
                f"Assinado em {fmt_dt(sig.get('assinada_em'), com_hora=True)}"
                f"  ·  IP {sig.get('assinante_ip') or '-'}"
                f"  ·  Geo {sig.get('assinante_geo') or 'não informada'}"
            )
            c.drawString(MARGEM + 3 * mm, yy, detalhe)
            yy -= 5 * mm
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica", 7)
        c.drawString(MARGEM + 3 * mm, yy, f"Hash do documento (SHA-256): {auth.get('documento_hash') or '-'}")
        yy -= 4.4 * mm
        c.setFont("Helvetica-Oblique", 6.5)
        c.drawString(MARGEM + 3 * mm, yy,
                     f"Datas e horas no {TZ_BR_LABEL}. Assinatura eletrônica nos termos do "
                     "art. 107 do Código Civil e da Lei nº 14.063/2020.")
    else:
        y = _garantir(y, 10 * mm)
        c.setFillColor(TEXTO_CLARO)
        c.setFont("Helvetica-Oblique", 8)
        pendentes = "do proprietário" if len(signatarios) == 1 else "dos proprietários"
        c.drawString(MARGEM, y, f"Documento aguardando assinatura eletrônica {pendentes}.")

    _rodape()
    c.showPage()
    c.save()
    return buffer.getvalue()
