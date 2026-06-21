"""Testes dos formatadores compartilhados de PDF (app.services.pdf_base).

Foco no fmt_dt: o banco grava timestamps em UTC e a trilha de auditoria
(assinatura eletrônica) precisa exibir o horário no fuso do Brasil. Estes
testes travam essa conversão pra que o bug do horário em UTC não volte.
"""
from datetime import datetime, timezone

from app.services.pdf_base import fmt_dt


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
    # "2026-06-18" não tem fuso (naive) — fica como está, sem deslocar o dia.
    assert fmt_dt("2026-06-18") == "18/06/2026"
    assert fmt_dt("2026-06-18", com_hora=True) == "18/06/2026 00:00"


def test_fmt_dt_aceita_objeto_datetime_aware():
    dt = datetime(2026, 6, 18, 21, 51, tzinfo=timezone.utc)
    assert fmt_dt(dt, com_hora=True) == "18/06/2026 18:51"


def test_fmt_dt_vazio_retorna_travessao():
    assert fmt_dt(None) == "—"
    assert fmt_dt("") == "—"


def test_fmt_dt_valor_invalido_nao_quebra():
    # Não deve levantar exceção e estourar a geração do PDF: cai no fallback
    # str(valor)[:10] (os 10 primeiros caracteres, como uma data ISO).
    assert fmt_dt("texto qualquer que nao parseia") == "texto qual"
