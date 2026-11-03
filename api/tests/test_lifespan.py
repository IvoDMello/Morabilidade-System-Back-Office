"""Lifespan da API: liga e desliga o agendador do relatório de 30 dias.

O scheduler nunca pode impedir a API de subir: se ele falhar ao iniciar, a app
segue sem ele (e não tenta desligar o que não ligou).
"""
import asyncio
from unittest.mock import patch

from app import main


def _rodar_lifespan():
    async def ciclo():
        async with main.lifespan(main.app):
            pass

    asyncio.run(ciclo())


def _ambiente(monkeypatch, app_env="production", scheduler_enabled=True):
    monkeypatch.setattr(main.settings, "app_env", app_env)
    monkeypatch.setattr(main.settings, "scheduler_enabled", scheduler_enabled)


def test_liga_e_desliga_o_scheduler(monkeypatch):
    _ambiente(monkeypatch)
    with patch("app.scheduler.iniciar_scheduler") as iniciar, patch("app.scheduler.parar_scheduler") as parar:
        _rodar_lifespan()
    iniciar.assert_called_once_with(hora=main.settings.relatorio_30dias_hora)
    parar.assert_called_once()


def test_falha_ao_iniciar_nao_derruba_a_api(monkeypatch, caplog):
    _ambiente(monkeypatch)
    with patch("app.scheduler.iniciar_scheduler", side_effect=RuntimeError("tz")), patch(
        "app.scheduler.parar_scheduler"
    ) as parar:
        _rodar_lifespan()
    parar.assert_not_called()
    assert "Falha ao iniciar o scheduler" in caplog.text


def test_desligado_por_configuracao_ou_em_teste(monkeypatch):
    for app_env, ligado in (("production", False), ("test", True)):
        _ambiente(monkeypatch, app_env=app_env, scheduler_enabled=ligado)
        with patch("app.scheduler.iniciar_scheduler") as iniciar:
            _rodar_lifespan()
        iniciar.assert_not_called()
