"""Acesso à tabela `configuracoes` (chave/valor jsonb).

Centraliza leitura/escrita dos parâmetros globais da imobiliária para que tanto
o router de configurações quanto os geradores de PDF leiam do mesmo lugar.
"""
from __future__ import annotations

from app.database import supabase_admin
from app.schemas.configuracao import DadosRecebimento

CHAVE_DADOS_RECEBIMENTO = "dados_recebimento"


def get_config(chave: str) -> dict:
    """Lê o valor jsonb de uma chave. Retorna {} se não existir."""
    res = (
        supabase_admin.table("configuracoes")
        .select("valor")
        .eq("chave", chave)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not res:
        return {}
    return res[0].get("valor") or {}


def set_config(chave: str, valor: dict) -> dict:
    """Grava (upsert) o valor jsonb de uma chave e devolve o valor salvo."""
    existente = (
        supabase_admin.table("configuracoes")
        .select("chave")
        .eq("chave", chave)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existente:
        supabase_admin.table("configuracoes").update({"valor": valor}).eq(
            "chave", chave
        ).execute()
    else:
        supabase_admin.table("configuracoes").insert(
            {"chave": chave, "valor": valor}
        ).execute()
    return valor


def get_dados_recebimento() -> DadosRecebimento:
    """Conta que recebe a taxa de administração (box do demonstrativo)."""
    return DadosRecebimento(**get_config(CHAVE_DADOS_RECEBIMENTO))
