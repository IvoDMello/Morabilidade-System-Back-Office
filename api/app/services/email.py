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
                <a href="{_SITE_URL}" style="color:{_OLIVE};text-decoration:none;">morabilidade.com</a>
                &nbsp;·&nbsp;
                <a href="{_INSTAGRAM}" style="color:{_OLIVE};text-decoration:none;">@morabilidade</a>
              </p>
              <p style="margin:0;color:#aaa;">
                Imobiliária 100% digital, atendimento por WhatsApp e Instagram.
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


def enviar_email(
    to: str,
    subject: str,
    html: str,
    attachments: list | None = None,
) -> None:
    """Envia um e-mail transacional via Resend.

    attachments (opcional), lista de dicts no formato do Resend:
        [{"filename": "demonstrativo.pdf", "content": <bytes>}]
    Bytes são convertidos para a representação aceita pelo SDK.
    """
    payload: dict = {
        "from": settings.email_from,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if attachments:
        # Resend espera list[int] (bytes) ou string base64 em `content`.
        # O SDK Python aceita bytes diretamente desde 2.x.
        payload["attachments"] = [
            {
                "filename": a["filename"],
                "content": list(a["content"]) if isinstance(a["content"], (bytes, bytearray)) else a["content"],
            }
            for a in attachments
        ]
    resend.Emails.send(payload)


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
        titulo="Recebemos seu contato: Morabilidade",
        preheader="Obrigada! Nossa equipe vai te responder em breve.",
        conteudo_html=conteudo,
    )
    enviar_email(email_visitante, "Recebemos seu contato: Morabilidade", html)


def enviar_recuperacao_senha(email: str, link: str) -> None:
    """E-mail de recuperação de senha com link de redefinição."""
    conteudo = f"""
      <h1 style="margin:0 0 12px;font-size:22px;color:{_OLIVE};font-weight:600;">
        Redefinição de senha
      </h1>
      <p style="margin:0 0 16px;">
        Recebemos uma solicitação para redefinir a senha da sua conta no sistema Morabilidade.
      </p>
      <p style="margin:0 0 24px;color:#555;">
        Clique no botão abaixo para criar uma nova senha. O link é válido por
        <strong>1 hora</strong> e pode ser usado apenas uma vez.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:{_OLIVE};border-radius:8px;">
            <a href="{link}"
               style="display:inline-block;padding:14px 28px;color:#ffffff;
                      text-decoration:none;font-weight:600;font-size:15px;
                      letter-spacing:0.3px;">
              Redefinir minha senha
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:13px;color:#888;">
        Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
      </p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all;">
        <a href="{link}" style="color:{_OLIVE};text-decoration:none;">{link}</a>
      </p>

      <div style="border-top:1px solid #e6e6dd;padding-top:16px;margin-top:8px;">
        <p style="margin:0;font-size:13px;color:#aaa;">
          Se você não solicitou a redefinição de senha, ignore este e-mail.
          Sua senha permanece a mesma.
        </p>
      </div>
    """
    html = _render_template(
        titulo="Redefinição de senha: Morabilidade",
        preheader="Clique no link para criar uma nova senha. Válido por 1 hora.",
        conteudo_html=conteudo,
    )
    enviar_email(email, "Redefinição de senha: Morabilidade", html)


def enviar_demonstrativo_locacao(
    *,
    para: str,
    nome_locatario: str,
    mes_label: str,
    endereco_imovel: str,
    total_brl: str,
    vencimento_brl: str,
    pdf_bytes: bytes,
    nome_arquivo: str,
) -> None:
    """Envia o demonstrativo mensal ao locatário, com o PDF em anexo."""
    nome_safe = html_lib.escape(nome_locatario.split()[0] if nome_locatario else "")
    mes_safe = html_lib.escape(mes_label)
    end_safe = html_lib.escape(endereco_imovel or "")
    conteudo = f"""
      <h1 style="margin:0 0 12px;font-size:22px;color:{_OLIVE};font-weight:600;">
        Demonstrativo de {mes_safe}
      </h1>
      <p style="margin:0 0 16px;">
        Olá, {nome_safe}! Segue em anexo o demonstrativo da locação referente a
        <strong>{mes_safe}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:separate;border-spacing:0;border:1px solid #e6e6dd;border-radius:8px;overflow:hidden;font-size:14px;">
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;width:140px;font-weight:600;">Imóvel</td>
          <td style="padding:10px 14px;">{end_safe}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Total a pagar</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;color:{_OLIVE};font-weight:700;">{total_brl}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Vencimento</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;">{vencimento_brl}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;color:#777;font-size:13px;">
        O detalhamento completo está no PDF anexo. Em caso de dúvidas,
        responda este e-mail ou nos chame no WhatsApp.
      </p>
    """
    html = _render_template(
        titulo=f"Demonstrativo {mes_label}: Morabilidade",
        preheader=f"Total a pagar {total_brl} · vencimento {vencimento_brl}.",
        conteudo_html=conteudo,
    )
    enviar_email(
        para,
        f"Demonstrativo {mes_label}: Morabilidade",
        html,
        attachments=[{"filename": nome_arquivo, "content": pdf_bytes}],
    )


def enviar_relatorio_30dias(
    *,
    para: str,
    proprietario_nome: str,
    proprietario_telefone: str | None,
    codigo_imovel: str,
    endereco: str,
    anunciado_em: str,
    visitas_comprovadas: int,
    pdf_bytes: bytes,
) -> None:
    """Relatório de 30 dias: resumo curto no corpo + PDF completo em anexo.

    Destino interno por enquanto (futuro: proprietário), por isso o corpo traz o
    contato do proprietário, para facilitar o repasse manual. O detalhamento
    (visitas e análise) vai no PDF gerado por [relatorio_30dias_pdf].
    """
    nome_safe = html_lib.escape(proprietario_nome or "-")
    telefone_safe = html_lib.escape(proprietario_telefone or "-")
    codigo_safe = html_lib.escape(codigo_imovel)
    endereco_safe = html_lib.escape(endereco or "-")
    anunciado_safe = html_lib.escape(anunciado_em or "-")

    conteudo = f"""
      <h1 style="margin:0 0 12px;font-size:22px;color:{_OLIVE};font-weight:600;">
        Relatório de 30 dias, {codigo_safe}
      </h1>
      <p style="margin:0 0 16px;">
        O imóvel <strong>{codigo_safe}</strong> completou 30 dias em portfólio.
        Resumo abaixo; o relatório completo (visitas e análise) está no PDF anexo.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:separate;border-spacing:0;border:1px solid #e6e6dd;
                    border-radius:8px;overflow:hidden;font-size:14px;">
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;width:160px;font-weight:600;">Proprietário</td>
          <td style="padding:10px 14px;">{nome_safe}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Telefone</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;">{telefone_safe}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Imóvel</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;">{endereco_safe}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Anunciado em</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;">{anunciado_safe}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;background:#fafaf6;color:#666;font-weight:600;border-top:1px solid #e6e6dd;">Visitas comprovadas</td>
          <td style="padding:10px 14px;border-top:1px solid #e6e6dd;color:{_OLIVE};font-weight:700;">{visitas_comprovadas}</td>
        </tr>
      </table>

      <p style="margin:28px 0 0;color:#777;font-size:13px;">
        Detalhamento das visitas e da nossa análise no PDF em anexo.
      </p>
    """
    html = _render_template(
        titulo=f"Relatório 30 dias, {codigo_imovel}",
        preheader=f"Resumo dos primeiros 30 dias de {codigo_imovel}.",
        conteudo_html=conteudo,
    )
    enviar_email(
        para,
        f"Relatório 30 dias, {codigo_imovel}",
        html,
        attachments=[{"filename": f"relatorio-30dias-{codigo_imovel}.pdf", "content": pdf_bytes}],
    )


def enviar_notificacao_lead(
    *, nome: str, email: str, telefone: str, mensagem: str
) -> None:
    """Notificação interna para a equipe quando um lead chega pelo site."""
    nome_safe = html_lib.escape(nome)
    email_safe = html_lib.escape(email)
    telefone_safe = html_lib.escape(telefone) if telefone else "-"
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
