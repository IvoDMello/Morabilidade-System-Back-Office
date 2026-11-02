"""Acesso ao Supabase da importação do Radar (via PostgREST, com service role).

Separado da lógica em `importacao` para os testes trocarem por um repositório
em memória. Tudo em lotes: a primeira carga são ~620 mil linhas.
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterable, Iterator
from itertools import islice
from typing import Any, TypeVar

from postgrest.types import ReturnMethod

logger = logging.getLogger(__name__)

T = TypeVar("T")

LOTE_TRANSACOES = 1000
LOTE_LOGRADOUROS = 2000
LOTE_HASHES_LEITURA = 50_000
LOTE_HASHES_REMOCAO = 5_000


def _lotes(itens: Iterable[T], tamanho: int) -> Iterator[list[T]]:
    it = iter(itens)
    while lote := list(islice(it, tamanho)):
        yield lote


def _com_retentativa(executar: Callable[[], Any], tentativas: int = 3) -> Any:
    """Repete chamadas que falham por rede. Seguro porque toda escrita aqui é
    idempotente (insert que ignora duplicado, delete por hash, upsert)."""
    for tentativa in range(1, tentativas + 1):
        try:
            return executar()
        except Exception:  # noqa: BLE001, erro do PostgREST/httpx varia de tipo
            if tentativa == tentativas:
                raise
            logger.warning("Falha no Supabase (tentativa %d), repetindo.", tentativa, exc_info=True)
            time.sleep(2 * tentativa)


class RepositorioSupabase:
    def __init__(self, cliente: Any):
        self.db = cliente

    def ultima_importacao_ok(self) -> dict | None:
        res = (
            self.db.table("radar_importacoes")
            .select("id, arquivos")
            .eq("status", "ok")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def abrir_importacao(self, status: str, arquivos: list[dict]) -> int:
        res = (
            self.db.table("radar_importacoes")
            .insert({"status": status, "arquivos": arquivos})
            .execute()
        )
        return res.data[0]["id"]

    def concluir_importacao(self, importacao_id: int, campos: dict) -> None:
        self.db.table("radar_importacoes").update(campos).eq("id", importacao_id).execute()

    def listar_hashes(self) -> set[str]:
        hashes: set[str] = set()
        depois = ""
        while True:
            lote = _com_retentativa(
                lambda: self.db.rpc(
                    "radar_listar_hashes",
                    {"p_depois": depois, "p_limite": LOTE_HASHES_LEITURA},
                ).execute().data
            ) or []
            hashes.update(lote)
            if len(lote) < LOTE_HASHES_LEITURA:
                return hashes
            depois = lote[-1]

    def gravar_transacoes(self, linhas: Iterable[dict], sobrescrever: bool) -> None:
        total = 0
        for lote in _lotes(linhas, LOTE_TRANSACOES):
            _com_retentativa(
                lambda: self.db.table("radar_transacoes")
                .upsert(
                    lote,
                    on_conflict="hash",
                    ignore_duplicates=not sobrescrever,
                    returning=ReturnMethod.minimal,
                )
                .execute()
            )
            total += len(lote)
            if total % 50_000 < LOTE_TRANSACOES:
                logger.info("Transações gravadas: %d", total)
        logger.info("Transações gravadas: %d", total)

    def remover_hashes(self, hashes: list[str]) -> int:
        removidas = 0
        for lote in _lotes(hashes, LOTE_HASHES_REMOCAO):
            removidas += _com_retentativa(
                lambda: self.db.rpc("radar_remover_hashes", {"p_hashes": lote}).execute().data
            ) or 0
        return removidas

    def marcar_fracoes(self) -> int:
        return _com_retentativa(
            lambda: self.db.rpc("radar_marcar_fracoes", {}).execute().data
        ) or 0

    def gravar_logradouros(self, logradouros: list[dict], nomes: list[dict]) -> None:
        # Logradouros antes das grafias: radar_logradouro_nomes referencia o cl.
        for tabela, linhas, conflito in (
            ("radar_logradouros", logradouros, "cl"),
            ("radar_logradouro_nomes", nomes, "cl,nome_busca"),
        ):
            for lote in _lotes(linhas, LOTE_LOGRADOUROS):
                _com_retentativa(
                    lambda: self.db.table(tabela)
                    .upsert(lote, on_conflict=conflito, returning=ReturnMethod.minimal)
                    .execute()
                )

    def gravar_bairros(self, bairros: list[dict]) -> None:
        _com_retentativa(
            lambda: self.db.table("radar_bairros_resumo")
            .upsert(bairros, on_conflict="chave", returning=ReturnMethod.minimal)
            .execute()
        )

    def limpar_logradouros(self, importacao_id: int) -> None:
        self.db.rpc("radar_limpar_logradouros", {"p_importacao": importacao_id}).execute()
