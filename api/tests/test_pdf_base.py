"""Testes dos formatadores compartilhados de PDF (app.services.pdf_base).

Foco no fmt_dt: o banco grava timestamps em UTC e a trilha de auditoria
(assinatura eletrônica) precisa exibir o horário no fuso do Brasil. Estes
testes travam essa conversão pra que o bug do horário em UTC não volte.
"""
from datetime import datetime, timezone

from app.services.pdf_base import fmt_dt, mascarar_telefone, nome_e_sobrenome


def test_fmt_dt_converte_utc_para_brasilia_com_hora():
    # 21:51 UTC == 18:51 em Brasília (UTC-3). Caso real da assinatura.
    assert fmt_dt("2026-06-18T21:51:00+00:00", com_hora=True) == "18/06/2026 18:51"


def test_fmt_dt_aceita_sufixo_z():
    assert fmt_dt("2026-06-18T21:51:00Z", com_hora=True) == "18/06/2026 18:51"


def test_fmt_dt_converte_data_quando_vira_dia_anterior():
    # 01:00 UTC == 22:00 do dia anterior no Brasil: a DATA também muda.
    assert fmt_dt("2026-06-18T01:00:00+00:00") == "17/06/2026"
    assert fmt_dt("2026-06-18T01:00:00+00:00", com_hora=True) == "17/06/2026 22:00"


def test_fmt_dt_string_so_data_e_naive_nao_converte():
    # "2026-06-18" não tem fuso (naive), fica como está, sem deslocar o dia.
    assert fmt_dt("2026-06-18") == "18/06/2026"
    assert fmt_dt("2026-06-18", com_hora=True) == "18/06/2026 00:00"


def test_fmt_dt_aceita_objeto_datetime_aware():
    dt = datetime(2026, 6, 18, 21, 51, tzinfo=timezone.utc)
    assert fmt_dt(dt, com_hora=True) == "18/06/2026 18:51"


def test_fmt_dt_vazio_retorna_travessao():
    assert fmt_dt(None) == "-"
    assert fmt_dt("") == "-"


def test_fmt_dt_valor_invalido_nao_quebra():
    # Não deve levantar exceção e estourar a geração do PDF: cai no fallback
    # str(valor)[:10] (os 10 primeiros caracteres, como uma data ISO).
    assert fmt_dt("texto qualquer que nao parseia") == "texto qual"


# ── nome_e_sobrenome / mascarar_telefone ─────────────────────────────────────
# Usados nos relatórios que vão para o proprietário: o visitante é identificado
# sem entregar nome completo nem telefone. Ver [relatorio_visitas_pdf].

def test_nome_e_sobrenome_descarta_nomes_do_meio():
    assert nome_e_sobrenome("Ana Clara de Souza Lima") == "Ana Lima"
    assert nome_e_sobrenome("Victor Bathich") == "Victor Bathich"


def test_nome_e_sobrenome_nome_unico_e_vazio():
    assert nome_e_sobrenome("Madonna") == "Madonna"
    assert nome_e_sobrenome("   ") == "-"
    assert nome_e_sobrenome(None) == "-"


def test_mascara_telefone_celular_mantem_ddd_e_quatro_ultimos():
    assert mascarar_telefone("(21) 99772-9990") == "219 **** - 9990"
    assert mascarar_telefone("21997729990") == "219 **** - 9990"


def test_mascara_telefone_ignora_codigo_do_pais():
    # Número salvo pelo WhatsApp vem com o 55 na frente; o DDD tem que sobreviver.
    assert mascarar_telefone("5521997729990") == "219 **** - 9990"


def test_mascara_telefone_fixo():
    assert mascarar_telefone("(21) 3333-4444") == "213 **** - 4444"


def test_mascara_telefone_invalido_retorna_travessao():
    assert mascarar_telefone(None) == "-"
    assert mascarar_telefone("") == "-"
    assert mascarar_telefone("1234") == "-"
