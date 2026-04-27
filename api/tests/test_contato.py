"""Testes do endpoint público de contato."""
from unittest.mock import patch, AsyncMock, MagicMock


PAYLOAD_VALIDO = {
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "11988887777",
    "mensagem": "Tenho interesse em um imóvel.",
}


# ── POST /contato/ ────────────────────────────────────────────────────────────

def test_enviar_contato_retorna_204(anon_client):
    with patch("app.routers.contato.enviar_email", new_callable=AsyncMock):
        res = anon_client.post("/contato", json=PAYLOAD_VALIDO)
    assert res.status_code == 204


def test_enviar_contato_sem_telefone_retorna_204(anon_client):
    payload = {**PAYLOAD_VALIDO, "telefone": ""}
    with patch("app.routers.contato.enviar_email", new_callable=AsyncMock):
        res = anon_client.post("/contato", json=payload)
    assert res.status_code == 204


def test_enviar_contato_sem_nome_retorna_422(anon_client):
    payload = {k: v for k, v in PAYLOAD_VALIDO.items() if k != "nome"}
    res = anon_client.post("/contato", json=payload)
    assert res.status_code == 422


def test_enviar_contato_email_invalido_retorna_422(anon_client):
    res = anon_client.post("/contato", json={**PAYLOAD_VALIDO, "email": "nao-e-email"})
    assert res.status_code == 422


def test_enviar_contato_sem_mensagem_retorna_422(anon_client):
    payload = {k: v for k, v in PAYLOAD_VALIDO.items() if k != "mensagem"}
    res = anon_client.post("/contato", json=payload)
    assert res.status_code == 422


def test_enviar_contato_nome_muito_longo_retorna_422(anon_client):
    res = anon_client.post("/contato", json={**PAYLOAD_VALIDO, "nome": "A" * 201})
    assert res.status_code == 422


def test_enviar_contato_mensagem_muito_longa_retorna_422(anon_client):
    res = anon_client.post("/contato", json={**PAYLOAD_VALIDO, "mensagem": "x" * 5001})
    assert res.status_code == 422


def test_enviar_contato_escapa_html_no_nome(anon_client):
    """Verifica que o nome com HTML é escapado (proteção contra XSS no e-mail)."""
    payload = {**PAYLOAD_VALIDO, "nome": "<script>alert(1)</script>"}
    captured = {}

    def fake_email(dest, assunto, corpo):
        captured["assunto"] = assunto
        captured["corpo"] = corpo

    with patch("app.routers.contato.enviar_email", side_effect=fake_email):
        res = anon_client.post("/contato", json=payload)

    assert res.status_code == 204
    assert "<script>" not in captured.get("assunto", "")
    assert "<script>" not in captured.get("corpo", "")


def test_enviar_contato_acessivel_sem_autenticacao(anon_client):
    """Endpoint é público — não requer token."""
    with patch("app.routers.contato.enviar_email", new_callable=AsyncMock):
        res = anon_client.post("/contato", json=PAYLOAD_VALIDO)
    assert res.status_code != 403
