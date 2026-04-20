"use client";

import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
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
  const { theme, setTheme } = useTheme();

  const title = pageTitles[pathname] ?? "Morabilidade";

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 bg-white dark:bg-slate-900 border-b"
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
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {user && (
          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.nome_completo}</p>
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
      </div>
    </header>
  );
}
