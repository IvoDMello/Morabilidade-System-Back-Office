"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Instagram, ArrowRight } from "lucide-react";

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
    <>
      <header
        className="sticky top-0 z-50"
        style={{ backgroundColor: "#585a4f", height: "clamp(64px, 8vw, 76px)" }}
      >
        <div
          className="flex items-center justify-between h-full"
          style={{ padding: "0 clamp(20px, 5vw, 48px)" }}
        >
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <Image
              src="/Logo_fundoTransparente.png"
              alt="Morabilidade"
              width={220}
              height={64}
              style={{ height: "clamp(50px, 6vw, 62px)", width: "auto", objectFit: "contain" }}
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    fontSize: 14,
                    color: active ? "#fcfcfc" : "rgba(252,252,252,0.6)",
                    textDecoration: "none",
                    borderBottom: active ? "1.5px solid #d8cb6a" : "none",
                    paddingBottom: active ? 2 : 0,
                    transition: "color 0.15s",
                    fontWeight: active ? 500 : 400,
                  }}
                  className="hover:!text-[#fcfcfc]"
                >
                  {link.label}
                </Link>
              );
            })}
            <div style={{ width: 1, height: 18, backgroundColor: "rgba(252,252,252,0.18)" }} />
            <a
              href="https://www.instagram.com/morabilidade"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @morabilidade"
              style={{ color: "rgba(252,252,252,0.6)", display: "flex", alignItems: "center" }}
              className="hover:!text-[#fcfcfc] transition-colors"
            >
              <Instagram className="w-[18px] h-[18px]" />
            </a>
            <Link
              href="/imoveis"
              style={{
                backgroundColor: "#d8cb6a",
                color: "#3e4037",
                fontWeight: 700,
                padding: "7px 16px",
                borderRadius: 6,
                fontSize: 13,
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "opacity 0.15s",
              }}
              className="hover:opacity-90"
            >
              Ver imóveis
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center"
            style={{ background: "transparent", border: "none", color: "#fcfcfc", cursor: "pointer", padding: 4 }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile menu — fullscreen overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 flex flex-col"
          style={{ top: "clamp(64px, 8vw, 76px)", backgroundColor: "#3e4037", padding: "32px 28px" }}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "18px 0",
                fontSize: 22,
                fontFamily: "var(--font-playfair), Georgia, serif",
                color: "#fcfcfc",
                textDecoration: "none",
                borderBottom: "1px solid rgba(252,252,252,0.08)",
              }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/imoveis"
            onClick={() => setOpen(false)}
            style={{
              display: "inline-flex",
              marginTop: 32,
              backgroundColor: "#d8cb6a",
              color: "#3e4037",
              fontWeight: 700,
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 15,
              textDecoration: "none",
              alignItems: "center",
              gap: 8,
              width: "fit-content",
            }}
          >
            Ver imóveis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </>
  );
}
