"use client";

import { useAuthStore } from "@/lib/auth-store";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Painel",
  "/imoveis": "Imóveis",
  "/imoveis/novo": "Novo imóvel",
  "/clientes": "Clientes",
  "/clientes/novo": "Novo cliente",
  "/tags": "Tags",
  "/usuarios": "Usuários",
};

export function Header() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const title = pageTitles[pathname] ?? "Morabilidade";

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.nome_completo}</p>
            <p className="text-xs text-slate-500 capitalize">{user.perfil}</p>
          </div>
          {user.foto_url ? (
            <img
              src={user.foto_url}
              alt={user.nome_completo}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
              {user.nome_completo?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
