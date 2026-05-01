"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  Tags,
  UserCog,
  LayoutDashboard,
  LogOut,
  X,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/imoveis", label: "Imóveis", icon: Building2 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
  { href: "/usuarios", label: "Usuários", icon: UserCog, adminOnly: true },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Painel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col flex-shrink-0",
          "transition-transform duration-200 ease-in-out",
          "md:relative md:translate-x-0 md:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: "#585a4f" }}
      >
        {/* Logo + fechar (mobile) */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <Image
            src="/Logo_fundoTransparente.png"
            alt="Morabilidade"
            width={168}
            height={46}
            className="object-contain"
            priority
          />
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && user?.perfil !== "admin") return null;

            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "font-semibold"
                    : "text-white/75 hover:text-white hover:bg-white/10"
                )}
                style={active ? { backgroundColor: "#d8cb6a", color: "#585a4f" } : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Usuário + logout */}
        <div className="p-3 border-t border-white/10 space-y-1">
          {user && (
            <Link
              href="/perfil"
              onClick={onClose}
              className="block px-3 py-2 rounded-lg hover:bg-white/10 transition"
            >
              <p className="text-sm font-medium text-white truncate">{user.nome_completo}</p>
              <p className="text-xs text-white/50 capitalize">{user.perfil} · Editar perfil</p>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
