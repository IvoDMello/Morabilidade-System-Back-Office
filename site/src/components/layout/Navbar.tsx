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
      className="sticky top-0 z-50 transition-all duration-200 border-b"
      style={{
        backgroundColor: "#585a4f",
        borderColor: "rgba(255,255,255,0.08)",
        boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.30)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={120}
              height={34}
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
                    ? "text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
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
            <div className="ml-4 pl-4 border-l border-white/20 flex items-center gap-3">
              <a
                href="https://www.instagram.com/morabilidade"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @morabilidade"
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <Link
                href="/imoveis"
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 hover:shadow-md"
                style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
              >
                Ver imóveis
              </Link>
            </div>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-white/80 hover:bg-white/10 transition"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10" style={{ backgroundColor: "#4a4d43" }}>
          <nav className="flex flex-col px-4 py-3 gap-0.5">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive(link.href)
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/imoveis"
              onClick={() => setOpen(false)}
              className="mt-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-center"
              style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
            >
              Ver todos os imóveis
            </Link>
            <a
              href="https://www.instagram.com/morabilidade"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 flex items-center gap-2"
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
