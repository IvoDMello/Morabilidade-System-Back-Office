"""Leitor de .xlsx em streaming do Radar."""
import pytest

from app.services.radar.xlsx import PlanilhaInvalida, ler_linhas, ler_planilha
from tests.radar_planilha import criar_xlsx


def test_le_cabecalho_e_linhas_decodificando_escape(tmp_path):
    caminho = criar_xlsx(tmp_path / "p.xlsx", [
        ["ano", "logradouro", "numero"],
        [2025, "RUA_x0020_ENEAS_x0020_MARTINS", "_x0031_88"],
        [2024, ("inline", "AVN_x0020_BRASIL"), 7],
    ])
    linhas = list(ler_planilha(caminho))
    assert linhas == [
        {"ano": "2025", "logradouro": "RUA ENEAS MARTINS", "numero": "188"},
        {"ano": "2024", "logradouro": "AVN BRASIL", "numero": "7"},
    ]


def test_celula_ausente_vira_texto_vazio_e_linha_vazia_e_pulada(tmp_path):
    caminho = criar_xlsx(tmp_path / "p.xlsx", [
        ["a", "b", "c"],
        ["1", None, "3"],
        [None, None, None],
        ["4", "5"],
    ])
    assert list(ler_planilha(caminho)) == [
        {"a": "1", "b": "", "c": "3"},
        {"a": "4", "b": "5", "c": ""},
    ]


def test_segue_o_rels_ate_a_primeira_aba(tmp_path):
    caminho = criar_xlsx(tmp_path / "p.xlsx", [["x"], ["1"]], aba="worksheets/dados.xml")
    assert list(ler_linhas(caminho)) == [["x"], ["1"]]


def test_arquivo_que_nao_e_xlsx(tmp_path):
    falso = tmp_path / "erro.xlsx"
    falso.write_text("<html>Página não encontrada</html>")
    with pytest.raises(PlanilhaInvalida):
        list(ler_planilha(falso))


def test_planilha_sem_linhas(tmp_path):
    caminho = criar_xlsx(tmp_path / "p.xlsx", [])
    assert list(ler_planilha(caminho)) == []


# ── Variações de formato que outros geradores produzem ──────────────────────

import zipfile as _zipfile  # noqa: E402

_NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def _xlsx_manual(caminho, arquivos: dict[str, str]):
    with _zipfile.ZipFile(caminho, "w") as z:
        for nome, conteudo in arquivos.items():
            z.writestr(nome, conteudo)
    return caminho


def _aba(linhas_xml: str) -> str:
    return f'<worksheet xmlns="{_NS_MAIN}"><sheetData>{linhas_xml}</sheetData></worksheet>'


def test_sem_workbook_nem_strings_compartilhadas_le_sheet1_com_inline(tmp_path):
    from app.services.radar.xlsx import ler_linhas

    caminho = _xlsx_manual(tmp_path / "minima.xlsx", {
        "xl/worksheets/sheet1.xml": _aba(
            '<row><c t="inlineStr"><is><t>a</t></is></c><c t="inlineStr"/><c><v>3</v></c></row>'
        ),
    })
    assert list(ler_linhas(caminho)) == [["a", "", "3"]]


def test_texto_rico_e_celulas_sem_referencia(tmp_path):
    from app.services.radar.xlsx import ler_linhas

    strings = (
        f'<sst xmlns="{_NS_MAIN}">'
        "<si><r><t>Rua </t></r><r><t>Bom Pastor</t></r><r/></si>"
        "<si><t>X</t><rPh><t>fonetica</t></rPh></si>"
        "</sst>"
    )
    caminho = _xlsx_manual(tmp_path / "rica.xlsx", {
        "xl/sharedStrings.xml": strings,
        "xl/worksheets/sheet1.xml": _aba(
            '<row><c t="s"><v>0</v></c><c r="?"><v>9</v></c><c t="s"><v>1</v></c></row><row/>'
        ),
    })
    assert list(ler_linhas(caminho)) == [["Rua Bom Pastor", "9", "X"], []]


def test_aba_com_caminho_absoluto_no_rels(tmp_path):
    from app.services.radar.xlsx import ler_linhas

    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    caminho = _xlsx_manual(tmp_path / "absoluto.xlsx", {
        "xl/workbook.xml": (
            f'<workbook xmlns="{_NS_MAIN}" xmlns:r="{rel}"><sheets>'
            '<sheet name="Dados" sheetId="1" r:id="rId9"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId9" Target="/xl/worksheets/dados.xml"/></Relationships>'
        ),
        "xl/worksheets/dados.xml": _aba('<row><c r="B1"><v>1</v></c></row>'),
    })
    assert list(ler_linhas(caminho)) == [["", "1"]]


def test_rels_sem_a_aba_cai_no_sheet1(tmp_path):
    from app.services.radar.xlsx import ler_linhas

    rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    caminho = _xlsx_manual(tmp_path / "sem_rel.xlsx", {
        "xl/workbook.xml": (
            f'<workbook xmlns="{_NS_MAIN}" xmlns:r="{rel}"><sheets>'
            '<sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
        ),
        "xl/worksheets/sheet1.xml": _aba('<row><c r="A1"><v>ok</v></c></row>'),
    })
    assert list(ler_linhas(caminho)) == [["ok"]]
