"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Instagram } from "lucide-react";

const links = [
  { href: "/", label: "Início" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white shadow-nav border-b border-slate-100"
          : "bg-white border-b border-slate-100"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={148}
              height={40}
              className="object-contain"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive(link.href)
                    ? "text-olive-600"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ backgroundColor: "#d8cb6a" }}
                  />
                )}
              </Link>
            ))}
            <div className="ml-4 pl-4 border-l border-slate-200 flex items-center gap-3">
              <a
                href="https://www.instagram.com/morabilidade"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @morabilidade"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <Link
                href="/imoveis"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-md"
                style={{ backgroundColor: "#585a4f" }}
              >
                Ver imóveis
              </Link>
            </div>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <nav className="flex flex-col px-4 py-3 gap-0.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive(link.href)
                    ? "bg-olive-50 text-olive-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/imoveis"
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: "#585a4f" }}
            >
              Ver todos os imóveis
            </Link>
            <a
              href="https://www.instagram.com/morabilidade"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
            >
              <Instagram className="w-4 h-4" />
              @morabilidade
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
