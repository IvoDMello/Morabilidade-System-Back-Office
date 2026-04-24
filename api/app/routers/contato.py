import html
from fastapi import APIRouter, BackgroundTasks, Request, status
from pydantic import BaseModel, EmailStr, Field
from app.services.email import enviar_email
from app.config import settings
from app.limiter import limiter

router = APIRouter()


class ContatoForm(BaseModel):
    nome: str = Field(..., max_length=200)
    email: EmailStr
    telefone: str = Field("", max_length=50)
    mensagem: str = Field(..., max_length=5000)


@router.post("/", status_code=status.HTTP_204_NO_CONTENT, tags=["Site Público"])
@limiter.limit("5/minute")
def enviar_contato(request: Request, body: ContatoForm, background_tasks: BackgroundTasks):
    """Recebe mensagem do formulário de contato do site público e envia por e-mail."""
    nome = html.escape(body.nome)
    email = html.escape(str(body.email))
    telefone = html.escape(body.telefone)
    mensagem = html.escape(body.mensagem).replace("&#x0a;", "<br>").replace("\n", "<br>")

    mensagem_html = f"""
    <h2 style="color:#585a4f;">Nova mensagem de contato pelo site</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
      <tr><td style="padding:8px;color:#555;width:120px;"><strong>Nome</strong></td><td style="padding:8px;">{nome}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;color:#555;"><strong>E-mail</strong></td><td style="padding:8px;">{email}</td></tr>
      <tr><td style="padding:8px;color:#555;"><strong>Telefone</strong></td><td style="padding:8px;">{telefone or "—"}</td></tr>
    </table>
    <h3 style="color:#585a4f;margin-top:20px;">Mensagem</h3>
    <p style="font-size:14px;line-height:1.6;color:#333;">{mensagem}</p>
    """
    background_tasks.add_task(
        enviar_email,
        settings.email_contato,
        f"[Site] Contato de {nome}",
        mensagem_html,
    )
