"""Leitura em streaming de planilhas .xlsx, só com a biblioteca padrão.

As planilhas de ITBI têm dezenas de MB compactadas e até ~210 MB de XML na aba.
O iterparse lê linha a linha e cada linha é limpa depois de usada, então a
memória fica no tamanho das strings compartilhadas (~80 mil textos), sem
depender do openpyxl. Só a primeira aba é lida.
"""
from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from pathlib import Path
from typing import IO

from app.services.radar.normalizacao import decodificar_excel

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_NS_DOC_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_NS_PKG_REL = "{http://schemas.openxmlformats.org/package/2006/relationships}"


class PlanilhaInvalida(Exception):
    """O arquivo não é um .xlsx legível (download truncado, página de erro...)."""


def ler_planilha(caminho: str | Path) -> Iterator[dict[str, str]]:
    """Itera as linhas da primeira aba como {cabeçalho: valor}.

    Os textos já saem sem o escape `_xHHHH_`. Linhas vazias são puladas.
    """
    linhas = ler_linhas(caminho)
    cabecalho = next(linhas, None)
    if not cabecalho:
        return
    cabecalho = [c.strip() for c in cabecalho]
    for valores in linhas:
        if not any(valores):
            continue
        yield {
            nome: (valores[i] if i < len(valores) else "")
            for i, nome in enumerate(cabecalho)
            if nome
        }


def ler_linhas(caminho: str | Path) -> Iterator[list[str]]:
    """Itera as linhas da primeira aba como listas de texto, na ordem das colunas."""
    try:
        arquivo = zipfile.ZipFile(caminho)
    except (zipfile.BadZipFile, OSError) as exc:
        raise PlanilhaInvalida(f"{caminho}: não é um .xlsx válido ({exc})") from exc
    with arquivo:
        strings = _strings_compartilhadas(arquivo)
        with arquivo.open(_primeira_aba(arquivo)) as aba:
            yield from _linhas(aba, strings)


def _strings_compartilhadas(arquivo: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in arquivo.namelist():
        return []
    strings: list[str] = []
    with arquivo.open("xl/sharedStrings.xml") as f:
        for _, el in ET.iterparse(f):
            if el.tag == _NS + "si":
                strings.append(decodificar_excel(_texto_rico(el)))
                el.clear()
    return strings


def _texto_rico(el: ET.Element) -> str:
    """Texto de um <si>/<is>: <t> direto ou trechos <r><t>. Ignora a guia
    fonética (<rPh>), que não faz parte do valor."""
    partes = []
    for filho in el:
        if filho.tag == _NS + "t":
            partes.append(filho.text or "")
        elif filho.tag == _NS + "r":
            t = filho.find(_NS + "t")
            partes.append(t.text or "" if t is not None else "")
    return "".join(partes)


def _primeira_aba(arquivo: zipfile.ZipFile) -> str:
    padrao = "xl/worksheets/sheet1.xml"
    try:
        workbook = ET.fromstring(arquivo.read("xl/workbook.xml"))
        aba = workbook.find(f"{_NS}sheets/{_NS}sheet")
        rid = aba.get(_NS_DOC_REL + "id") if aba is not None else None
        rels = ET.fromstring(arquivo.read("xl/_rels/workbook.xml.rels"))
    except KeyError:
        return padrao
    for rel in rels.iter(_NS_PKG_REL + "Relationship"):
        if rel.get("Id") == rid:
            alvo = rel.get("Target", "")
            return alvo.lstrip("/") if alvo.startswith("/") else f"xl/{alvo}"
    return padrao


def _coluna(referencia: str | None, padrao: int) -> int:
    """"C7" → 2. Sem referência (alguns geradores omitem), usa a posição."""
    if not referencia:
        return padrao
    m = re.match(r"[A-Z]+", referencia)
    if not m:
        return padrao
    indice = 0
    for letra in m.group(0):
        indice = indice * 26 + ord(letra) - 64
    return indice - 1


def _valor(celula: ET.Element, strings: list[str]) -> str:
    tipo = celula.get("t")
    if tipo == "inlineStr":
        caixa = celula.find(_NS + "is")
        return decodificar_excel(_texto_rico(caixa)) if caixa is not None else ""
    v = celula.find(_NS + "v")
    texto = v.text if v is not None and v.text else ""
    if tipo == "s" and texto:
        return strings[int(texto)]
    return decodificar_excel(texto)


def _linhas(aba: IO[bytes], strings: list[str]) -> Iterator[list[str]]:
    for _, el in ET.iterparse(aba):
        if el.tag != _NS + "row":
            continue
        valores: dict[int, str] = {}
        for posicao, celula in enumerate(el.iter(_NS + "c")):
            valores[_coluna(celula.get("r"), posicao)] = _valor(celula, strings)
        yield [valores.get(i, "") for i in range(max(valores) + 1)] if valores else []
        el.clear()
