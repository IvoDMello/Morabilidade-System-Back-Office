"""Testes do serviço de e-mail transacional (app/services/email.py).

Estratégia:
- `enviar_email`: patcha `resend.Emails.send` e inspeciona o payload montado.
- Templates `enviar_*`: patcham `enviar_email` e inspecionam destino/assunto/HTML,
  incluindo o escape de HTML (defesa contra injeção de markup nos dados).
"""
from unittest.mock import patch

from app.services import email as email_svc


# ── enviar_email (montagem do payload Resend) ────────────────────────────────

def test_enviar_email_monta_payload_basico():
    with patch("app.services.email.resend.Emails.send") as send:
        email_svc.enviar_email("dest@x.com", "Assunto", "<p>oi</p>")
    payload = send.call_args.args[0]
    assert payload["to"] == "dest@x.com"
    assert payload["subject"] == "Assunto"
    assert payload["html"] == "<p>oi</p>"
    assert "from" in payload
    assert "attachments" not in payload


def test_enviar_email_converte_anexo_bytes_em_lista():
    with patch("app.services.email.resend.Emails.send") as send:
        email_svc.enviar_email(
            "dest@x.com", "PDF", "<p>x</p>",
            attachments=[{"filename": "doc.pdf", "content": b"\x01\x02\x03"}],
        )
    payload = send.call_args.args[0]
    anexo = payload["attachments"][0]
    assert anexo["filename"] == "doc.pdf"
    # bytes viram list[int] (formato aceito pelo SDK Resend)
    assert anexo["content"] == [1, 2, 3]


def test_enviar_email_preserva_anexo_ja_em_string():
    with patch("app.services.email.resend.Emails.send") as send:
        email_svc.enviar_email(
            "dest@x.com", "PDF", "<p>x</p>",
            attachments=[{"filename": "doc.pdf", "content": "YWJj"}],
        )
    payload = send.call_args.args[0]
    assert payload["attachments"][0]["content"] == "YWJj"


# ── Templates ─────────────────────────────────────────────────────────────────

def test_enviar_boas_vindas():
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_boas_vindas("Maria Silva", "maria@x.com")
    dest, assunto, html = env.call_args.args
    assert dest == "maria@x.com"
    assert "Morabilidade" in assunto
    assert "Maria Silva" in html


def test_enviar_confirmacao_contato_usa_primeiro_nome():
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_confirmacao_contato("João Pedro Souza", "joao@x.com")
    dest, _assunto, html = env.call_args.args
    assert dest == "joao@x.com"
    assert "João" in html  # só o primeiro nome na saudação


def test_enviar_confirmacao_contato_nome_vazio_nao_quebra():
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_confirmacao_contato("", "anon@x.com")
    dest, _a, _h = env.call_args.args
    assert dest == "anon@x.com"


def test_enviar_recuperacao_senha_inclui_link():
    link = "https://painel.morabilidade.com/redefinir-senha?token=abc"
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_recuperacao_senha("user@x.com", link)
    dest, assunto, html = env.call_args.args
    assert dest == "user@x.com"
    assert "senha" in assunto.lower()
    assert link in html


def test_enviar_demonstrativo_locacao_anexa_pdf():
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_demonstrativo_locacao(
            para="loc@x.com",
            nome_locatario="Ana Costa",
            mes_label="Junho/2026",
            endereco_imovel="Rua X, 100",
            total_brl="R$ 2.500,00",
            vencimento_brl="10/06/2026",
            pdf_bytes=b"%PDF-1.4",
            nome_arquivo="demonstrativo.pdf",
        )
    dest, assunto, html = env.call_args.args
    kwargs = env.call_args.kwargs
    assert dest == "loc@x.com"
    assert "Junho/2026" in assunto
    assert "R$ 2.500,00" in html
    assert kwargs["attachments"][0]["filename"] == "demonstrativo.pdf"
    assert kwargs["attachments"][0]["content"] == b"%PDF-1.4"


def test_enviar_relatorio_30dias_inclui_resumo_e_anexo():
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_relatorio_30dias(
            para="equipe@x.com",
            proprietario_nome="Carlos",
            proprietario_telefone="2199999",
            codigo_imovel="IMO-00042",
            endereco="Rua Y, 50",
            anunciado_em="01/05/2026",
            visitas_comprovadas=4,
            pdf_bytes=b"%PDF",
        )
    dest, assunto, html = env.call_args.args
    kwargs = env.call_args.kwargs
    assert dest == "equipe@x.com"
    assert "IMO-00042" in assunto
    assert "IMO-00042" in html
    assert "4" in html  # visitas comprovadas
    assert kwargs["attachments"][0]["filename"] == "relatorio-30dias-IMO-00042.pdf"


def test_enviar_notificacao_lead_escapa_html():
    """Dados do lead vêm de formulário público, devem ser escapados (anti-injeção)."""
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_notificacao_lead(
            nome="<script>alert(1)</script>",
            email="x@x.com",
            telefone="219",
            mensagem="linha1\nlinha2",
        )
    _dest, _assunto, html = env.call_args.args
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html
    # quebras de linha viram <br>
    assert "linha1<br>linha2" in html


def test_enviar_notificacao_lead_vai_para_contato_interno():
    from app.config import settings
    with patch("app.services.email.enviar_email") as env:
        email_svc.enviar_notificacao_lead(
            nome="Ana", email="ana@x.com", telefone="", mensagem="oi"
        )
    dest, assunto, _html = env.call_args.args
    assert dest == settings.email_contato
    assert assunto.startswith("[Site]")
