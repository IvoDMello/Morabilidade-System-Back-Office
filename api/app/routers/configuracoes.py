"""Configurações globais da imobiliária (somente admin)."""
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user, require_admin
from app.schemas.configuracao import DadosRecebimento, DadosRecebimentoUpdate
from app.services.configuracoes import (
    CHAVE_DADOS_RECEBIMENTO,
    get_dados_recebimento,
    set_config,
)

router = APIRouter()


@router.get("/dados-recebimento", response_model=DadosRecebimento)
def ler_dados_recebimento(current_user: dict = Depends(get_current_user)):
    """Conta que recebe a taxa de administração (impressa no demonstrativo)."""
    return get_dados_recebimento()


@router.put("/dados-recebimento", response_model=DadosRecebimento)
def atualizar_dados_recebimento(
    payload: DadosRecebimentoUpdate,
    current_user: dict = Depends(require_admin),
):
    """Atualiza os dados de recebimento. Mantém os campos não enviados."""
    atual = get_dados_recebimento().model_dump()
    atual.update(payload.model_dump(exclude_unset=True))
    salvo = set_config(CHAVE_DADOS_RECEBIMENTO, atual)
    return DadosRecebimento(**salvo)
