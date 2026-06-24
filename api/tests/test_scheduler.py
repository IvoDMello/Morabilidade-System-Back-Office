"""Testes do agendador interno (APScheduler).

Não subimos threads reais: mockamos `BackgroundScheduler` e verificamos a
montagem do job, a idempotência (não reinicia se já rodando) e o wrapper que
isola exceções do job para o scheduler não morrer.
"""
from unittest.mock import MagicMock, patch

import app.scheduler as sched


def teardown_function():
    sched._scheduler = None


def test_iniciar_scheduler_monta_job_e_inicia():
    fake = MagicMock()
    fake.running = False
    with patch("app.scheduler.BackgroundScheduler", return_value=fake):
        result = sched.iniciar_scheduler(hora=9, minuto=30)
    assert result is fake
    fake.add_job.assert_called_once()
    # id do job correto
    assert fake.add_job.call_args.kwargs["id"] == "relatorio_30dias"
    fake.start.assert_called_once()


def test_iniciar_scheduler_idempotente_se_ja_rodando():
    rodando = MagicMock()
    rodando.running = True
    sched._scheduler = rodando
    with patch("app.scheduler.BackgroundScheduler") as ctor:
        result = sched.iniciar_scheduler()
    assert result is rodando
    ctor.assert_not_called()  # não cria um segundo scheduler


def test_parar_scheduler_desliga_e_limpa():
    rodando = MagicMock()
    rodando.running = True
    sched._scheduler = rodando
    sched.parar_scheduler()
    rodando.shutdown.assert_called_once_with(wait=False)
    assert sched._scheduler is None


def test_parar_scheduler_sem_instancia_nao_quebra():
    sched._scheduler = None
    sched.parar_scheduler()  # não deve lançar
    assert sched._scheduler is None


def test_rodar_relatorio_chama_processamento():
    with patch("app.scheduler.processar_relatorios_30dias", return_value={"enviados": 1}) as proc:
        sched._rodar_relatorio_30dias()
    proc.assert_called_once()


def test_rodar_relatorio_isola_excecao_do_job():
    """Erro no job não pode propagar (mataria o scheduler)."""
    with patch("app.scheduler.processar_relatorios_30dias", side_effect=RuntimeError("boom")):
        sched._rodar_relatorio_30dias()  # não deve lançar
