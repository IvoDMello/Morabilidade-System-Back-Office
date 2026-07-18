"""Schemas de configurações globais da imobiliária (tabela `configuracoes`)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class DadosRecebimento(BaseModel):
    """Conta que recebe a taxa de administração, impressa no box "Dados para
    pagamento" do Demonstrativo de Administração. Editável pelo painel."""
    titular: str = ""
    banco: str = ""
    agencia: str = ""
    conta: str = ""
    pix: str = ""

    def preenchido(self) -> bool:
        return any([self.titular, self.banco, self.agencia, self.conta, self.pix])


class DadosRecebimentoUpdate(BaseModel):
    titular: Optional[str] = None
    banco: Optional[str] = None
    agencia: Optional[str] = None
    conta: Optional[str] = None
    pix: Optional[str] = None
