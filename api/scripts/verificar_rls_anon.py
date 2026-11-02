"""Verifica se tabelas sensíveis estão expostas à anon key (sem RLS).

Tenta ler cada tabela DIRETO pelo PostgREST do Supabase usando a anon key
(pública, a mesma do bundle do navegador). Se alguma retornar linhas, ela está
exposta, qualquer um na internet poderia lê-la sem login. É o "passo 0" da
migration 039_rls_lockdown.sql: rode antes (para confirmar o buraco) e depois
(para confirmar que fechou).

RLS ligado sem policy NÃO dá erro: o PostgREST responde 200 com `[]`, igual a
uma tabela vazia sem RLS. Para separar os dois casos, quando há service role
key o script confere se a tabela tem linhas: tem linhas e a anon vê `[]` é
RLS funcionando; tabela vazia fica como inconclusiva.

Uso:
    # usa SUPABASE_URL, SUPABASE_ANON_KEY e (opcional) SUPABASE_SERVICE_ROLE_KEY
    # do ambiente / .env
    python scripts/verificar_rls_anon.py

    # ou explícito:
    SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... \
        python scripts/verificar_rls_anon.py

Só faz GETs de leitura (limit=1). Não escreve nada. Seguro de rodar em produção.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

# Tabelas que a migration 039 protege (devem estar BLOQUEADAS para a anon key).
TABELAS = [
    "acao_audit_log",
    "autorizacao_signatarios",
    "autorizacoes_intermediacao",
    "contratos_locacao",
    "fichas_visita",
    "imovel_favoritos",
    "imovel_percepcoes",
    "imovel_shares",
    "imovel_video_clicks",
    "imovel_visitas",
    "locacao_anexos",
    "locacao_audit_log",
    "locacao_pagamentos",
    "locacao_reajustes",
    "page_views",
    "search_events",
    # Radar (migration 055): leitura pública só pela API.
    "radar_importacoes",
    "radar_transacoes",
    "radar_logradouros",
    "radar_logradouro_nomes",
    "radar_bairros_resumo",
    # Já protegidas na migration 001, incluídas como controle (devem dar BLOQUEADA).
    "clientes",
    "usuarios",
]


def _carregar_env() -> tuple[str, str, str | None]:
    valores = {
        nome: os.environ.get(nome)
        for nome in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
    }
    # Fallback: tenta ler do .env da pasta api/ (mesmo dir do app).
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as fh:
            for linha in fh:
                nome, _, valor = linha.strip().partition("=")
                if nome in valores and not valores[nome]:
                    valores[nome] = valor.strip().strip('"')
    url, key = valores["SUPABASE_URL"], valores["SUPABASE_ANON_KEY"]
    if not url or not key:
        sys.exit(
            "Defina SUPABASE_URL e SUPABASE_ANON_KEY (no ambiente ou em api/.env)."
        )
    return url.rstrip("/"), key, valores["SUPABASE_SERVICE_ROLE_KEY"]


def _ler(base_url: str, chave: str, tabela: str) -> list | None:
    """Linhas que a chave consegue ler (até 1). None se o acesso foi negado."""
    url = f"{base_url}/rest/v1/{tabela}?select=*&limit=1"
    req = urllib.request.Request(url, headers={
        "apikey": chave,
        "Authorization": f"Bearer {chave}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8", "replace") or "[]")
    except urllib.error.HTTPError as exc:
        # 401/403/permission denied == acesso negado (sem GRANT para anon).
        if exc.code in (401, 403):
            return None
        raise


def _verificar(base_url: str, anon_key: str, service_key: str | None, tabela: str) -> tuple[str, str]:
    """Retorna (situação, detalhe). Situação: exposta, bloqueada ou inconclusiva."""
    try:
        anon = _ler(base_url, anon_key, tabela)
    except Exception as exc:  # noqa: BLE001
        return "inconclusiva", f"erro: {type(exc).__name__}: {exc}"
    if anon is None:
        return "bloqueada", "acesso negado à anon"
    if anon:
        return "exposta", "a anon leu linhas da tabela"
    if not service_key:
        return "inconclusiva", "anon vê 0 linhas (defina SUPABASE_SERVICE_ROLE_KEY para confirmar)"
    try:
        tem_linhas = bool(_ler(base_url, service_key, tabela))
    except Exception as exc:  # noqa: BLE001
        return "inconclusiva", f"anon vê 0 linhas; erro ao conferir: {type(exc).__name__}"
    if tem_linhas:
        return "bloqueada", "RLS: a tabela tem linhas e a anon vê 0"
    return "inconclusiva", "tabela vazia, não dá para afirmar"


def main() -> int:
    base_url, anon_key, service_key = _carregar_env()
    print(f"Verificando {base_url} com a anon key...\n")
    expostas: list[str] = []
    inconclusivas: list[str] = []
    marcas = {"exposta": "❌ EXPOSTA     ", "bloqueada": "✅ bloqueada   ", "inconclusiva": "❔ inconclusiva"}
    for tabela in TABELAS:
        situacao, detalhe = _verificar(base_url, anon_key, service_key, tabela)
        print(f"  {marcas[situacao]}  {tabela:<28} {detalhe}")
        if situacao == "exposta":
            expostas.append(tabela)
        elif situacao == "inconclusiva":
            inconclusivas.append(tabela)

    print()
    if expostas:
        print(f"⚠️  {len(expostas)} tabela(s) LEGÍVEIS pela anon key pública:")
        print("    " + ", ".join(expostas))
        print("    Aplique api/migrations/039_rls_lockdown.sql e rode de novo.")
        return 1
    if inconclusivas:
        print(f"❔ Nenhuma tabela exposta; {len(inconclusivas)} sem como confirmar (vazias ou sem service key):")
        print("    " + ", ".join(inconclusivas))
        return 0
    print("✅ Nenhuma tabela exposta à anon key. RLS está fazendo seu trabalho.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
