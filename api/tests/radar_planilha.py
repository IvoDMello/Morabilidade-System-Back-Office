"""Monta .xlsx mínimos para os testes do Radar (sem openpyxl).

Strings viram texto compartilhado (como nas planilhas da Prefeitura), números
viram célula numérica, ("inline", texto) vira inlineStr e None pula a célula.
"""
from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def _letra(indice: int) -> str:
    letras = ""
    indice += 1
    while indice:
        indice, resto = divmod(indice - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def criar_xlsx(caminho: Path, linhas: list[list], aba: str = "worksheets/sheet1.xml") -> Path:
    strings: list[str] = []
    posicoes: dict[str, int] = {}
    xml_linhas = []
    for n, linha in enumerate(linhas, start=1):
        celulas = []
        for i, valor in enumerate(linha):
            ref = f"{_letra(i)}{n}"
            if valor is None:
                continue
            if isinstance(valor, tuple):
                celulas.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(valor[1])}</t></is></c>')
            elif isinstance(valor, str):
                if valor not in posicoes:
                    posicoes[valor] = len(strings)
                    strings.append(valor)
                celulas.append(f'<c r="{ref}" t="s"><v>{posicoes[valor]}</v></c>')
            else:
                celulas.append(f'<c r="{ref}"><v>{valor}</v></c>')
        xml_linhas.append(f'<row r="{n}">{"".join(celulas)}</row>')

    shared = "".join(f"<si><t>{escape(s)}</t></si>" for s in strings)
    with zipfile.ZipFile(caminho, "w") as z:
        z.writestr(
            "xl/workbook.xml",
            f'<workbook xmlns="{_NS}" xmlns:r="{_NS_R}"><sheets>'
            '<sheet name="QUERY" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f'<Relationship Id="rId1" Type="{_NS_R}/worksheet" Target="{aba}"/>'
            "</Relationships>",
        )
        z.writestr(
            "xl/sharedStrings.xml",
            f'<sst xmlns="{_NS}" count="{len(strings)}" uniqueCount="{len(strings)}">{shared}</sst>',
        )
        z.writestr(
            f"xl/{aba}",
            f'<worksheet xmlns="{_NS}"><sheetData>{"".join(xml_linhas)}</sheetData></worksheet>',
        )
    return caminho


# Cabeçalho real do arquivo "2025 em diante" (o de 2011 a 2024 troca bairro por
# nm_bairro_norm, descricao por DESCRICAO e vl_declarado por valor_transacoes).
CABECALHO_2025 = [
    "ano", "mes", "ano_texto", "mes_texto", "regiao_fiscal", "CD_BAIRRO", "cl",
    "trecho", "cod_tipologia", "id_utilizacao", "numero", "COMPLEMENTO", "bairro",
    "logradouro", "ds_imovel_tipologia", "descricao", "parte_transferida",
    "vl_declarado", "area", "valor_m2",
]
CABECALHO_ANTIGO = [
    "ano", "mes", "ano_texto", "mes_texto", "regiao_fiscal", "CD_BAIRRO", "cl",
    "trecho", "cod_tipologia", "id_utilizacao", "numero", "COMPLEMENTO",
    "nm_bairro_norm", "logradouro", "ds_imovel_tipologia", "DESCRICAO",
    "parte_transferida", "valor_transacoes", "area", "valor_m2",
]


def linha_itbi(
    ano=2025, mes=1, cd_bairro="_x0030_90", cl="83360", trecho="2", cod_tipologia="_x0031_0",
    id_utilizacao="1", numero="_x0035_10", complemento="APT_x0020_302", bairro="IPANEMA",
    logradouro="AVN_x0020_VIEIRA_x0020_SOUTO", tipologia="APARTAMENTO", uso="RESIDENCIAL",
    parte="_x0031_00", valor="5000000", area="100", valor_m2="50000",
) -> list:
    """Uma linha no formato da Prefeitura, já com os escapes `_xHHHH_` reais."""
    return [
        ano, mes, f"_x0032_0{str(ano)[2:]}", f"_x0030_{mes}", "A", cd_bairro, cl, trecho,
        cod_tipologia, id_utilizacao, numero, complemento, bairro, logradouro, tipologia,
        uso, parte, valor, area, valor_m2,
    ]
