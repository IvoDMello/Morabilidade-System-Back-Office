"""
Remove definitivamente usuários inativos (auth.users + tabela usuarios via cascade).
Libera os e-mails para reuso. Pede confirmação antes de deletar.

Uso (a partir de api/):
    .venv/Scripts/python.exe scripts/remover_usuarios_inativos.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import supabase_admin


def main() -> int:
    inativos = (
        supabase_admin.table("usuarios")
        .select("id, nome_completo, email, perfil")
        .eq("ativo", False)
        .execute()
    )

    if not inativos.data:
        print("Nenhum usuário inativo encontrado.")
        return 0

    print(f"Encontrados {len(inativos.data)} usuário(s) inativo(s):")
    for u in inativos.data:
        print(f"  - {u['nome_completo']:<20} {u['email']:<35} ({u['perfil']})")

    resposta = input("\nConfirmar remoção DEFINITIVA destes usuários? (digite 'SIM'): ").strip()
    if resposta != "SIM":
        print("Operação cancelada.")
        return 1

    sucesso, falha = 0, 0
    for u in inativos.data:
        try:
            supabase_admin.auth.admin.delete_user(u["id"])
            print(f"  OK   {u['email']}")
            sucesso += 1
        except Exception as e:
            print(f"  FAIL {u['email']}: {e}")
            falha += 1

    print(f"\nResumo: {sucesso} removido(s), {falha} falha(s).")
    return 0 if falha == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
