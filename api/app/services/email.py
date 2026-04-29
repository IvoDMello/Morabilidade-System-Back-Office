"""
Envio de e-mails transacionais com templates HTML branded.

Padrão de uso: as funções `enviar_*` montam o HTML usando `_render_template`
(layout base com cabeçalho, conteúdo e rodapé Morabilidade) e enviam via Resend.
"""
import html as html_lib

import resend

from app.config import settings

resend.api_key = settings.resend_api_key


# ── Template base ────────────────────────────────────────────────────────────

# Cores oficiais da marca (já em uso no painel e no site).
_OLIVE = "#585a4f"
_GOLD = "#d8cb6a"
_BG = "#f5f5f0"

_INSTAGRAM = "https://instagram.com/morabilidade"
_SITE_URL = settings.site_url


def _render_template(*, titulo: str, preheader: str, conteudo_html: str) -> str:
    """
    Layout base usado em todos os e-mails.

    - `preheader` é o texto-prévia que aparece em clientes de e-mail (Gmail, Outlook).
    - `conteudo_html` é colocado dentro do card central; já deve estar "escapado".
    """
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html_lib.escape(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:{_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333;">
  <!-- preheader (oculto, aparece como prévia no inbox) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    {html_lib.escape(preheader)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card principal -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
               style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6dd;">

          <!-- Header com a marca -->
          <tr>
            <td style="background:{_OLIVE};padding:24px 28px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                MORABILIDADE
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:{_GOLD};letter-spacing:2px;text-transform:uppercase;">
                Simples · Eficiente · Humanizada
              </p>
            </td>
          </tr>

          <!-- Conteúdo -->
          <tr>
            <td style="padding:28px;font-size:15px;line-height:1.6;color:#333;">
              {conteudo_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafaf6;padding:18px 28px;border-top:1px solid #e6e6dd;
                       font-size:12px;color:#888;text-align:center;">
              <p style="margin:0 0 6px;">
                <a href="{_SITE_URL}" style="color:{_OLIVE};text-decoration:none;">morabilidade.com.br</a>
                &nbsp;·&nbsp;
                <a href="{_INSTAGRAM}" style="color:{_OLIVE};text-decoration:none;">@morabilidade</a>
              </p>
              <p style="margin:0;color:#aaa;">
                Imobiliária 100% digital — atendimento por WhatsApp e Instagram.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:11px;color:#999;">
          Você recebeu este e-mail porque entrou em contato com a Morabilidade.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>"""


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


# ── Templates específicos ────────────────────────────────────────────────────

def enviar_boas_vindas(nome: str, email: str) -> None:
    """E-mail de boas-vindas para usuário interno recém-cadastrado."""
    nome_safe = html_lib.escape(nome)
    conteudo = f"""
      <h1 style="margin:0 0 12px;font-size:22px;color:{_OLIVE};font-weight:600;">
        Bem-vindo(a), {nome_safe}!
      </h1>
      <p style="margin:0 0 16px;">
        Seu acesso ao sistema de gestão Morabilidade foi criado com sucesso.
      </p>
      <p style="margin:0 0 16px;">
        Acesse o painel usando seu e-mail e a senha definida pelo administrador.
      </p>
      <p style="margin:0;color:#777;font-size:13px;">
        Recomendamos que você altere sua senha no primeiro acesso, em
        <strong>Perfil → Trocar senha</strong>.
      </p>
    """
    html = _render_template(
        titulo="Bem-vindo ao sistema Morabilidade",
        preheader=f"Olá {nome}, seu acesso foi criado.",
        conteudo_html=conteudo,
    )
    enviar_email(email, "Bem-vindo ao sistema Morabilidade", html)


def enviar_confirmacao_contato(nome_visitante: str, email_visitante: str) -> None:
    """Confirmação enviada ao visitante que preencheu o formulário do site."""
    nome_safe = html_lib.escape(nome_visitante.split()[0] if nome_visitante else "")
    conteudo = f"""
      <h1 style="margin:0 0 12px;font-size:22px;color:{_OLIVE};font-weight:600;">
        Recebemos seu contato, {nome_safe}!
      </h1>
      <p style="margin:0 0 16px;">
        Obrigada por escrever para a Morabilidade. Nossa equipe vai te
        responder em breve pelo e-mail informado ou WhatsApp.
      </p>
      <p style="margin:0 0 24px;">
        Enquanto isso, você pode ver os imóveis disponíveis no nosso site
        ou nos seguir no Instagram para acompanhar lançamentos.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:{_OLIVE};border-radius:8px;">
            <a href="{_SITE_URL}/imoveis"
               style="display:inline-block;padding:12px 22px;color:#ffffff;
                      text-decoration:none;font-weight:600;font-size:14px;">
              Ver imóveis disponíveis
            </a>
          </td>
        </tr>
      </table>
    """
    html = _render_template(
        titulo="Recebemos seu contato — Morabilidade",
        preheader="Obrigada! Nossa equipe vai te responder em breve.",
        conteudo_html=conteudo,
    )
    enviar_email(email_visitante, "Recebemos seu contato — Morabilidade", html)


def enviar_notificacao_lead(
    *, nome: str, email: str, telefone: str, mensagem: str
) -> None:
    """Notificação interna para a equipe quando um lead chega pelo site."""
    nome_safe = html_lib.escape(nome)
    email_safe = html_lib.escape(email)
    telefone_safe = html_lib.escape(telefone) if telefone else "—"
    mensagem_safe = html_lib.escape(mensagem).replace("\n", "<br>")

    conteudo = f"""
      <h1 style="margin:0 0 12px;font-size:20px;color:{_OLIVE};font-weight:600;">
        Novo lead pelo site
      </h1>
      <p style="margin:0 0 20px;color:#555;">
        Você recebeu uma nova mensagem pelo formulário de contato.
        Responda o quanto antes para aumentar a taxa de conversão.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:separate;border-spacing:0;border:1px solid #e6e6dd;border-radius:8px;overflow:hidden;font-size:14px;">
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;width:120px;font-weight:600;">Nome</td>
          <td style="padding:10px 14px;">{nome_safe}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">E-mail</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;">
            <a href="mailto:{email_safe}" style="color:{_OLIVE};">{email_safe}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Telefone</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;">{telefone_safe}</td>
        </tr>
      </table>

      <h3 style="margin:24px 0 8px;font-size:14px;color:{_OLIVE};text-transform:uppercase;letter-spacing:1px;">
        Mensagem
      </h3>
      <div style="background:#fafaf6;border-left:3px solid {_GOLD};padding:14px 16px;
                  border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#333;">
        {mensagem_safe}
      </div>
    """
    html = _render_template(
        titulo=f"Novo lead: {nome}",
        preheader=f"{nome} entrou em contato pelo site.",
        conteudo_html=conteudo,
    )
    enviar_email(settings.email_contato, f"[Site] Novo lead: {nome}", html)
