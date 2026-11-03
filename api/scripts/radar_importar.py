"""Importa as transações de ITBI da Prefeitura do Rio para o Radar Morabilidade.

Uso (de dentro de api/):
    python scripts/radar_importar.py                  # descobre, baixa e importa
    python scripts/radar_importar.py --simular        # baixa e lê, sem tocar no banco
    python scripts/radar_importar.py --arquivos a.xlsx b.xlsx c.xlsx
    python scripts/radar_importar.py --forcar         # importa mesmo sem arquivo novo
                                                      # e passa da trava de remoção
    python scripts/radar_importar.py --reprocessar    # regrava todas as linhas (depois
                                                      # de mudar a normalização)

Credenciais: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente ou de api/.env.
Não precisa do resto das variáveis da API. Detalhes do fluxo em
app/services/radar/importacao.py.

Agendamento: roda toda semana pelo Agendador de Tarefas do Windows num PC no
Brasil (scripts/radar_agendar_windows.ps1), com pythonw e --log. Não roda no
GitHub Actions: o firewall da Prefeitura responde "Requisição Negada" aos
servidores do GitHub (testado em 2026-11-02).

Saída: 0 importou ou não havia novidade; 2 a trava de segurança barrou; 1 erro.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import tempfile
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_API_ROOT))

import httpx  # noqa: E402
from dotenv import dotenv_values  # noqa: E402

from app.services.radar.importacao import ImportacaoAbortada, importar  # noqa: E402
from app.services.radar.repositorio import RepositorioSupabase  # noqa: E402


def _credenciais() -> tuple[str, str]:
    arquivo_env = dotenv_values(_API_ROOT / ".env")
    url = os.environ.get("SUPABASE_URL") or arquivo_env.get("SUPABASE_URL")
    chave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or arquivo_env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not chave:
        raise RuntimeError("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ambiente ou api/.env).")
    return url, chave


def _configurar_log(arquivo: Path | None) -> None:
    """Terminal e, com --log, também um arquivo. Pelo pythonw (Agendador do
    Windows) não existe terminal, então o arquivo é o único registro."""
    saidas: list[logging.Handler] = []
    if sys.stderr is not None:
        saidas.append(logging.StreamHandler())
    if arquivo:
        arquivo.parent.mkdir(parents=True, exist_ok=True)
        saidas.append(logging.FileHandler(arquivo, encoding="utf-8"))
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=saidas,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--simular", action="store_true", help="lê as planilhas e não grava nada")
    parser.add_argument("--forcar", action="store_true", help="ignora a checagem de arquivo igual e a trava de remoção")
    parser.add_argument("--reprocessar", action="store_true", help="regrava todas as linhas existentes")
    parser.add_argument("--arquivos", nargs="+", type=Path, help="usa planilhas locais em vez de baixar")
    parser.add_argument("--pasta", type=Path, help="onde salvar os downloads (padrão: pasta temporária)")
    parser.add_argument("--log", type=Path, help="também grava o log neste arquivo")
    args = parser.parse_args()

    _configurar_log(args.log)
    try:
        return _executar(args)
    except Exception:
        logging.exception("Importação falhou")
        return 1


def _executar(args: argparse.Namespace) -> int:
    repo = None
    if not args.simular:
        from supabase import create_client

        repo = RepositorioSupabase(create_client(*_credenciais()))

    with tempfile.TemporaryDirectory(prefix="radar-itbi-") as temporaria, httpx.Client(
        timeout=httpx.Timeout(60.0, read=300.0),
        follow_redirects=True,
        # Cabeçalho HTTP só aceita ASCII.
        headers={"User-Agent": "Mozilla/5.0 (Radar Morabilidade; importacao mensal do ITBI)"},
    ) as http:
        pasta = args.pasta or Path(temporaria)
        pasta.mkdir(parents=True, exist_ok=True)
        try:
            resultado = importar(
                repo,
                http,
                pasta,
                arquivos_locais=args.arquivos,
                forcar=args.forcar,
                reprocessar=args.reprocessar,
                simular=args.simular,
            )
        except ImportacaoAbortada as exc:
            logging.error("Importação abortada: %s", exc)
            return 2
    logging.info("Resultado: %s", resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main())
