"""Lista todos os usuários internos remanescentes."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import supabase_admin

r = supabase_admin.table("usuarios").select("nome_completo, email, perfil, ativo").order("nome_completo").execute()
print(f"{len(r.data)} usuário(s):")
for u in r.data:
    status = "ATIVO" if u["ativo"] else "INATIVO"
    print(f"  [{status:7}] {u['nome_completo']:<20} {u['email']:<35} ({u['perfil']})")
