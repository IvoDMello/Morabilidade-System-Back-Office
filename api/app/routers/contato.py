from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel, EmailStr
from app.services.email import enviar_email
from app.config import settings

router = APIRouter()


class ContatoForm(BaseModel):
    nome: str
    email: EmailStr
    telefone: str = ""
    mensagem: str


@router.post("/", status_code=status.HTTP_204_NO_CONTENT, tags=["Site Público"])
def enviar_contato(body: ContatoForm, background_tasks: BackgroundTasks):
    """Recebe mensagem do formulário de contato do site público e envia por e-mail."""
    mensagem_html = f"""
    <h2 style="color:#585a4f;">Nova mensagem de contato pelo site</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
      <tr><td style="padding:8px;color:#555;width:120px;"><strong>Nome</strong></td><td style="padding:8px;">{body.nome}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;color:#555;"><strong>E-mail</strong></td><td style="padding:8px;">{body.email}</td></tr>
      <tr><td style="padding:8px;color:#555;"><strong>Telefone</strong></td><td style="padding:8px;">{body.telefone or "—"}</td></tr>
    </table>
    <h3 style="color:#585a4f;margin-top:20px;">Mensagem</h3>
    <p style="font-size:14px;line-height:1.6;color:#333;">{body.mensagem.replace(chr(10), "<br>")}</p>
    """
    background_tasks.add_task(
        enviar_email,
        settings.email_contato,
        f"[Site] Contato de {body.nome}",
        mensagem_html,
    )
