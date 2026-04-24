import resend
from app.config import settings

resend.api_key = settings.resend_api_key


def enviar_email(to: str, subject: str, html: str) -> None:
    """Envia um e-mail transacional via Resend."""
    resend.Emails.send(
        {
            "from": settings.email_from,
            "to": to,
            "subject": subject,
            "html": html,
        }
    )


def enviar_boas_vindas(nome: str, email: str) -> None:
    html = f"""
    <h2>Bem-vindo(a), {nome}!</h2>
    <p>Seu acesso ao sistema de gestão Morabilidade foi criado com sucesso.</p>
    <p>Acesse o painel usando seu e-mail e a senha definida pelo administrador.</p>
    <p>Recomendamos que você altere sua senha no primeiro acesso.</p>
    """
    enviar_email(email, "Bem-vindo ao sistema Morabilidade", html)
