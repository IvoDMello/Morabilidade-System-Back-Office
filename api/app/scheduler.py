"""Agendador interno (APScheduler) dos jobs recorrentes.

Hoje só o **relatório de 30 dias**. Roda dentro do próprio processo web (sempre
ativo no Railway), num `BackgroundScheduler` (thread separada) para não bloquear
o event loop do uvicorn com as chamadas síncronas ao Supabase/Resend.

Idempotente: o relatório marca `imoveis.relatorio_30dias_enviado_em`, então uma
reexecução (restart, misfire) não reenvia. Iniciado/encerrado pelo `lifespan` da
app em [main]; desligado nos testes (lifespan não roda) e via
`settings.scheduler_enabled=false`.

O endpoint HTTP `POST /imoveis/internal/jobs/relatorio-30dias` continua existindo
para disparo manual ou cron externo, ambos chamam o mesmo
`processar_relatorios_30dias`.
"""
import logging
from typing import Optional
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.routers.imovel_acompanhamento import processar_relatorios_30dias

logger = logging.getLogger(__name__)

_TZ = ZoneInfo("America/Sao_Paulo")
_scheduler: Optional[BackgroundScheduler] = None


def _rodar_relatorio_30dias() -> None:
    try:
        resultado = processar_relatorios_30dias()
        logger.info("Job agendado 'relatorio_30dias' concluído: %s", resultado)
    except Exception:  # noqa: BLE001, o scheduler não pode morrer por um erro do job
        logger.exception("Falha no job agendado 'relatorio_30dias'.")


def iniciar_scheduler(hora: int = 9, minuto: int = 0) -> BackgroundScheduler:
    """Sobe o scheduler (idempotente) com o relatório diário no horário dado."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler

    _scheduler = BackgroundScheduler(timezone=_TZ)
    _scheduler.add_job(
        _rodar_relatorio_30dias,
        CronTrigger(hour=hora, minute=minuto, timezone=_TZ),
        id="relatorio_30dias",
        replace_existing=True,
        coalesce=True,            # acumula disparos perdidos num só
        misfire_grace_time=3600,  # tolera até 1h de atraso (ex.: restart no horário)
    )
    _scheduler.start()
    logger.info(
        "Scheduler iniciado, relatório 30 dias às %02d:%02d (America/Sao_Paulo).",
        hora, minuto,
    )
    return _scheduler


def parar_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
