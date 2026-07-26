"""Exporta o schema OpenAPI da API para api/openapi.json (offline, sem servidor).

Fonte única de verdade dos contratos HTTP. Os fronts geram tipos TypeScript a
partir deste arquivo (ver web/site scripts `gen:api`), então quando um endpoint
muda no FastAPI e o JSON é regenerado, os fronts que chamam errado param de
COMPILAR — em vez de quebrar silenciosamente em produção (foi o vetor da
listagem de clientes quebrada em 2026-07-10).

Uso:
    python scripts/export_openapi.py            # escreve api/openapi.json
    python scripts/export_openapi.py --check    # falha se o arquivo estiver desatualizado (CI)

Roda com valores dummy de ambiente: só monta a app e serializa as rotas, nunca
abre conexão com Supabase nem lê o .env real.
"""

import json
import os
import sys
from pathlib import Path

# Valores dummy: `Settings()` roda no import de app.config e exige estas vars.
# Nenhuma chamada de rede acontece só por montar a app, então lixo serve — mas
# o cliente supabase valida o FORMATO da chave no construtor (create_client em
# app.database roda no import), então as chaves precisam parecer um JWT.
_FAKE_JWT = (
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.0000000000000000000000000000000000000000000"
)
_DUMMY_ENV = {
    "SUPABASE_URL": "https://dummy.supabase.co",
    "SUPABASE_ANON_KEY": _FAKE_JWT,
    "SUPABASE_SERVICE_ROLE_KEY": _FAKE_JWT,
    "SUPABASE_JWT_SECRET": "dummy",
    "RESEND_API_KEY": "dummy",
    "APP_SECRET_KEY": "dummy",
    "APP_ENV": "development",  # mantém /docs no schema; não afeta as rotas
}
for _k, _v in _DUMMY_ENV.items():
    os.environ.setdefault(_k, _v)

# Permite `import app.*` rodando de qualquer diretório.
_API_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_API_ROOT))

from app.main import app  # noqa: E402  (precisa vir depois do env dummy)

_OUT = _API_ROOT / "openapi.json"


def _schema_text() -> str:
    # sort_keys estabiliza a saída entre versões do Python/FastAPI, senão o
    # --check acusa drift falso por reordenação de chaves.
    return json.dumps(app.openapi(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def main() -> int:
    novo = _schema_text()
    if "--check" in sys.argv:
        if not _OUT.exists():
            print("openapi.json não existe. Rode: python scripts/export_openapi.py", file=sys.stderr)
            return 1
        atual = _OUT.read_text(encoding="utf-8")
        if atual != novo:
            print(
                "openapi.json está desatualizado. Rode `python scripts/export_openapi.py` "
                "e faça commit do resultado.",
                file=sys.stderr,
            )
            return 1
        print("openapi.json em dia.")
        return 0

    _OUT.write_text(novo, encoding="utf-8")
    print(f"Escrito {_OUT.relative_to(_API_ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
