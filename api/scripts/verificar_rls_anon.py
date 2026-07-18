"""Verifica se tabelas sensíveis estão expostas à anon key (sem RLS).

Tenta ler cada tabela DIRETO pelo PostgREST do Supabase usando a anon key
(pública, a mesma do bundle do navegador). Se alguma retornar dados/200, ela
está exposta, qualquer um na internet poderia lê-la sem login. É o "passo 0"
da migration 039_rls_lockdown.sql: rode antes (para confirmar o buraco) e
depois (para confirmar que fechou).

Uso:
    # usa SUPABASE_URL e SUPABASE_ANON_KEY do ambiente / .env
    python scripts/verificar_rls_anon.py

    # ou explícito:
    SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... \
        python scripts/verificar_rls_anon.py

Só faz GETs de leitura (limit=1). Não escreve nada. Seguro de rodar em produção.
"""
from __future__ import annotations

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
    # Já protegidas na migration 001, incluídas como controle (devem dar BLOQUEADA).
    "clientes",
    "usuarios",
]


def _carregar_env() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        # Fallback: tenta ler do .env da pasta api/ (mesmo dir do app).
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            with open(env_path, encoding="utf-8") as fh:
                for linha in fh:
                    linha = linha.strip()
                    if linha.startswith("SUPABASE_URL=") and not url:
                        url = linha.split("=", 1)[1].strip().strip('"')
                    elif linha.startswith("SUPABASE_ANON_KEY=") and not key:
                        key = linha.split("=", 1)[1].strip().strip('"')
    if not url or not key:
        sys.exit(
            "Defina SUPABASE_URL e SUPABASE_ANON_KEY (no ambiente ou em api/.env)."
        )
    return url.rstrip("/"), key


def _tentar_ler(base_url: str, anon_key: str, tabela: str) -> tuple[bool, str]:
    """Retorna (exposta, detalhe). exposta=True se a anon key conseguiu ler."""
    url = f"{base_url}/rest/v1/{tabela}?select=*&limit=1"
    req = urllib.request.Request(url, headers={
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            corpo = resp.read().decode("utf-8", "replace")
            linhas = corpo.strip()
            # 200 == leitura permitida pela anon (mesmo que retorne [] por estar vazia).
            return True, f"HTTP {resp.status} (retornou {len(linhas)} bytes)"
    except urllib.error.HTTPError as exc:
        # 401/403/permission denied == bloqueada (RLS ligado, sem policy anon).
        return False, f"HTTP {exc.code}"
    except Exception as exc:  # noqa: BLE001
        return False, f"erro: {type(exc).__name__}: {exc}"


def main() -> int:
    base_url, anon_key = _carregar_env()
    print(f"Verificando {base_url} com a anon key...\n")
    expostas: list[str] = []
    for tabela in TABELAS:
        exposta, detalhe = _tentar_ler(base_url, anon_key, tabela)
        marca = "❌ EXPOSTA " if exposta else "✅ bloqueada"
        print(f"  {marca}  {tabela:<28} {detalhe}")
        if exposta:
            expostas.append(tabela)

    print()
    if expostas:
        print(f"⚠️  {len(expostas)} tabela(s) LEGÍVEIS pela anon key pública:")
        print("    " + ", ".join(expostas))
        print("    Aplique api/migrations/039_rls_lockdown.sql e rode de novo.")
        return 1
    print("✅ Nenhuma tabela exposta à anon key. RLS está fazendo seu trabalho.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
