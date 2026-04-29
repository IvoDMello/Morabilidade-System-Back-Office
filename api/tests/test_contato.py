"""Testes do endpoint público de contato."""
from unittest.mock import patch


PAYLOAD_VALIDO = {
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "11988887777",
    "mensagem": "Tenho interesse em um imóvel.",
}


# ── POST /contato/ ────────────────────────────────────────────────────────────

def test_enviar_contato_retorna_204(anon_client):
    with patch("app.routers.contato.enviar_notificacao_lead"), \
         patch("app.routers.contato.enviar_confirmacao_contato"):
        res = anon_client.post("/contato", json=PAYLOAD_VALIDO)
    assert res.status_code == 204


def test_enviar_contato_sem_telefone_retorna_204(anon_client):
    payload = {**PAYLOAD_VALIDO, "telefone": ""}
    with patch("app.routers.contato.enviar_notificacao_lead"), \
         patch("app.routers.contato.enviar_confirmacao_contato"):
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


def test_enviar_contato_escapa_html_no_template(anon_client):
    """Nome com HTML é escapado dentro do template (proteção contra XSS no e-mail)."""
    from app.services.email import enviar_notificacao_lead

    captured = {}

    def fake_send(dest, assunto, corpo):
        captured["assunto"] = assunto
        captured["corpo"] = corpo

    with patch("app.services.email.enviar_email", side_effect=fake_send):
        enviar_notificacao_lead(
            nome="<script>alert(1)</script>",
            email="x@y.com",
            telefone="",
            mensagem="oi",
        )

    assert "<script>" not in captured["corpo"]
    assert "&lt;script&gt;" in captured["corpo"]


def test_enviar_contato_acessivel_sem_autenticacao(anon_client):
    """Endpoint é público — não requer token."""
    with patch("app.routers.contato.enviar_notificacao_lead"), \
         patch("app.routers.contato.enviar_confirmacao_contato"):
        res = anon_client.post("/contato", json=PAYLOAD_VALIDO)
    assert res.status_code != 403


def test_enviar_contato_dispara_dois_emails(anon_client):
    """Confirma que tanto a notificação interna quanto a confirmação ao visitante são enfileiradas."""
    with patch("app.routers.contato.enviar_notificacao_lead") as notif, \
         patch("app.routers.contato.enviar_confirmacao_contato") as conf:
        res = anon_client.post("/contato", json=PAYLOAD_VALIDO)
    assert res.status_code == 204
    notif.assert_called_once()
    conf.assert_called_once()
    # Confirmação vai para o e-mail do visitante
    assert conf.call_args.kwargs["email_visitante"] == PAYLOAD_VALIDO["email"]
