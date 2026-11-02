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
