"""Testes da geração do PDF do Relatório de Visitas (service puro).

O endpoint é coberto em test_relatorio_visitas.py; aqui exercitamos
`gerar_relatorio_visitas_pdf` direto, percorrendo os ramos de layout: sem
visitas, com visitas e com volume suficiente para forçar quebra de página
(caminho `_nova_pagina`).
"""
from app.services.relatorio_visitas_pdf import gerar_relatorio_visitas_pdf


def _base_dados():
    return {
        "codigo": "MOR-1",
        "endereco": "Rua das Flores, 100, Icaraí, Niterói",
        "anunciado_em": "01/05/2026",
        "emitido_em": "18/06/2026",
        "visitas": [],
    }


def test_gera_pdf_sem_visitas_retorna_bytes_validos():
    pdf = gerar_relatorio_visitas_pdf(_base_dados())
    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000


def test_gera_pdf_campos_ausentes_nao_quebra():
    """Dados mínimos (dict vazio) não devem quebrar o layout."""
    assert gerar_relatorio_visitas_pdf({}).startswith(b"%PDF-")


def test_gera_pdf_com_visitas():
    dados = _base_dados()
    dados["visitas"] = [
        {"nome": "Ana Clara de Souza Lima", "data": "2026-05-15T14:00:00+00:00",
         "telefone": "(21) 99772-9990"},
        {"nome": "João", "data": "2026-05-10T10:00:00+00:00", "telefone": None},
    ]
    assert gerar_relatorio_visitas_pdf(dados).startswith(b"%PDF-")


def test_gera_pdf_muitas_visitas_forca_quebra_de_pagina():
    dados = _base_dados()
    dados["visitas"] = [
        {"nome": f"Visitante Numero{i}", "data": "2026-05-10T10:00:00+00:00",
         "telefone": "21997729990"}
        for i in range(60)
    ]
    assert gerar_relatorio_visitas_pdf(dados).startswith(b"%PDF-")
