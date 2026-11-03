"""Revalidação on-demand do site: best-effort, nunca derruba o save do imóvel."""
from unittest.mock import patch

import httpx

from app.services import revalidacao


def _configurar(monkeypatch, segredo="s3gr3do", site="https://morabilidade.com/"):
    monkeypatch.setattr(revalidacao.settings, "site_revalidate_secret", segredo)
    monkeypatch.setattr(revalidacao.settings, "site_url", site)


def test_sem_segredo_nao_chama_o_site(monkeypatch):
    _configurar(monkeypatch, segredo="")
    with patch.object(revalidacao.httpx, "post") as post:
        revalidacao.revalidar_imovel("MB-00043")
    post.assert_not_called()


def test_sem_site_url_nao_chama_o_site(monkeypatch):
    _configurar(monkeypatch, site="")
    with patch.object(revalidacao.httpx, "post") as post:
        revalidacao.revalidar_imovel("MB-00043")
    post.assert_not_called()


def test_revalida_a_pagina_do_imovel_seguindo_redirect(monkeypatch):
    _configurar(monkeypatch)
    with patch.object(revalidacao.httpx, "post") as post:
        revalidacao.revalidar_imovel("MB-00043")
    post.assert_called_once_with(
        "https://morabilidade.com/api/revalidate",
        headers={"x-revalidate-secret": "s3gr3do"},
        json={"codigo": "MB-00043"},
        timeout=5.0,
        follow_redirects=True,
    )


def test_sem_codigo_revalida_so_listagem_e_home(monkeypatch):
    _configurar(monkeypatch)
    with patch.object(revalidacao.httpx, "post") as post:
        revalidacao.revalidar_imovel()
    assert post.call_args.kwargs["json"] == {}


def test_falha_de_rede_e_engolida_com_aviso(monkeypatch, caplog):
    _configurar(monkeypatch)
    with patch.object(revalidacao.httpx, "post", side_effect=httpx.ConnectTimeout("lento")):
        revalidacao.revalidar_imovel("MB-00043")
    assert "Falha ao revalidar site para MB-00043" in caplog.text
