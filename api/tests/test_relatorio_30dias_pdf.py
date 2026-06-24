"""Testes da geração do PDF do Relatório de 30 dias (service puro).

O endpoint é coberto em test_relatorio_30dias.py; aqui exercitamos
`gerar_relatorio_30dias_pdf` diretamente, percorrendo os ramos de layout:
sem visitas/percepções, com elementos, e volume suficiente para forçar
quebra de página (caminho `_nova_pagina`).
"""
from app.services.relatorio_30dias_pdf import gerar_relatorio_30dias_pdf


def _base_dados():
    return {
        "proprietario_nome": "Maria Souza",
        "proprietario_telefone": "(85) 99999-0000",
        "codigo": "MOR-1",
        "endereco": "Rua das Flores, 100",
        "anunciado_em": "01/05/2026",
        "visitas_comprovadas": 0,
        "visitas": [],
        "percepcoes": [],
    }


def test_gera_pdf_vazio_retorna_bytes_validos():
    pdf = gerar_relatorio_30dias_pdf(_base_dados())
    assert isinstance(pdf, bytes)
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000


def test_gera_pdf_campos_ausentes_usa_traco():
    """Dados mínimos (dict vazio) não devem quebrar o layout."""
    pdf = gerar_relatorio_30dias_pdf({})
    assert pdf.startswith(b"%PDF-")


def test_gera_pdf_com_visitas_e_percepcoes():
    dados = _base_dados()
    dados["visitas_comprovadas"] = 2
    dados["visitas"] = [
        {"nome": "João", "data": "2026-05-10T10:00:00+00:00"},
        {"nome": "Ana", "data": "2026-05-15T14:00:00+00:00"},
    ]
    dados["percepcoes"] = [
        {"texto": "Cliente gostou da localização.", "created_at": "2026-05-11T09:00:00+00:00"},
        {"texto": "Pediu desconto no valor.", "created_at": "2026-05-16T09:00:00+00:00"},
    ]
    pdf = gerar_relatorio_30dias_pdf(dados)
    assert pdf.startswith(b"%PDF-")


def test_gera_pdf_muitas_visitas_forca_quebra_de_pagina():
    """Volume grande de visitas exercita `_nova_pagina`."""
    dados = _base_dados()
    dados["visitas_comprovadas"] = 60
    dados["visitas"] = [
        {"nome": f"Visitante {i}", "data": "2026-05-10T10:00:00+00:00"}
        for i in range(60)
    ]
    pdf = gerar_relatorio_30dias_pdf(dados)
    assert pdf.startswith(b"%PDF-")


def test_gera_pdf_percepcoes_longas_forcam_quebra_de_pagina():
    dados = _base_dados()
    texto_longo = ("Lorem ipsum dolor sit amet " * 30).strip()
    dados["percepcoes"] = [
        {"texto": texto_longo, "created_at": "2026-05-11T09:00:00+00:00"}
        for _ in range(15)
    ]
    pdf = gerar_relatorio_30dias_pdf(dados)
    assert pdf.startswith(b"%PDF-")
