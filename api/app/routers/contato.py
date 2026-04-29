from fastapi import APIRouter, BackgroundTasks, Request, status
from pydantic import BaseModel, EmailStr, Field

from app.limiter import limiter
from app.services.email import enviar_confirmacao_contato, enviar_notificacao_lead

router = APIRouter()


class ContatoForm(BaseModel):
    nome: str = Field(..., max_length=200)
    email: EmailStr
    telefone: str = Field("", max_length=50)
    mensagem: str = Field(..., max_length=5000)


@router.post("", status_code=status.HTTP_204_NO_CONTENT, tags=["Site Público"])
@limiter.limit("5/minute")
def enviar_contato(request: Request, body: ContatoForm, background_tasks: BackgroundTasks):
    """
    Recebe mensagem do formulário de contato do site público.

    Dispara dois e-mails em background:
    - Notificação interna para a equipe Morabilidade.
    - Confirmação para o visitante.
    """
    background_tasks.add_task(
        enviar_notificacao_lead,
        nome=body.nome,
        email=str(body.email),
        telefone=body.telefone,
        mensagem=body.mensagem,
    )
    background_tasks.add_task(
        enviar_confirmacao_contato,
        nome_visitante=body.nome,
        email_visitante=str(body.email),
    )
