"use client";

import { Menu } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { usePathname } from "next/navigation";

interface HeaderProps {
  onMenuClick: () => void;
}

const pageTitles: Record<string, string> = {
  "/": "Painel",
  "/imoveis": "Imóveis",
  "/imoveis/novo": "Novo imóvel",
  "/clientes": "Clientes",
  "/clientes/novo": "Novo cliente",
  "/tags": "Tags",
  "/usuarios": "Usuários",
  "/perfil": "Meu perfil",
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const title = pageTitles[pathname] ?? "Morabilidade";

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 bg-white border-b"
      style={{ borderColor: "#d8cb6a" }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — só aparece no mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>

      {user && (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden sm:block">
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
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: "#d8cb6a", color: "#585a4f" }}
            >
              {user.nome_completo?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
