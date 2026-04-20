"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Início" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={140}
              height={38}
              className="object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={
                  isActive(link.href)
                    ? { color: "#585a4f", borderBottom: "2px solid #d8cb6a", paddingBottom: "2px" }
                    : { color: "#64748b" }
                }
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/imoveis"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f" }}
            >
              Ver imóveis
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <nav className="flex flex-col px-4 py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-slate-700 hover:text-slate-900 border-b border-slate-50 last:border-0"
                style={isActive(link.href) ? { color: "#585a4f" } : undefined}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/imoveis"
              onClick={() => setOpen(false)}
              className="mt-3 mb-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: "#585a4f" }}
            >
              Ver todos os imóveis
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
