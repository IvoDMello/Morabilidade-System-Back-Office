"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Instagram, ArrowRight } from "lucide-react";

const links = [
  { href: "/", label: "Início" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

/** Altura da navbar, para alinhar os elementos sticky da página. */
export const NAVBAR_ALTURA = "clamp(96px, 12vw, 104px)";

// Faixa mobile com a marca (só a listagem usa). O hambúrguer é fixed pra seguir
// alcançável depois do scroll, então o `top` dele sai da altura da faixa — é
// isso que mantém marca e botão no mesmo eixo vertical.
const FAIXA_MOBILE_ALTURA = 78;
const FAIXA_MOBILE_PADDING = 20;
const BURGER = 48;
const BURGER_TOP_NA_FAIXA = (FAIXA_MOBILE_ALTURA - BURGER) / 2;

interface NavbarProps {
  /** Mostra a faixa com a marca no mobile, alinhada com o hambúrguer. */
  marcaMobile?: boolean;
}

export function Navbar({ marcaMobile = false }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  // Trava o scroll da página e fecha o menu com Escape enquanto aberto
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className="hidden md:block sticky top-0 z-50"
        style={{ backgroundColor: "#585a4f", height: NAVBAR_ALTURA }}
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
              style={{ height: "clamp(68px, 10vw, 76px)", width: "auto", objectFit: "contain" }}
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="flex items-center gap-6">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    position: "relative",
                    fontSize: 14,
                    color: active ? "#d8cb6a" : "rgba(252,252,252,0.65)",
                    textDecoration: "none",
                    paddingBottom: 6,
                    transition: "color 0.15s",
                    fontWeight: active ? 600 : 400,
                    letterSpacing: active ? "0.02em" : "0",
                  }}
                  className="hover:!text-[#fcfcfc]"
                >
                  {link.label}
                  {active && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: -2,
                        height: 2,
                        backgroundColor: "#d8cb6a",
                        borderRadius: 1,
                      }}
                    />
                  )}
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

        </div>
      </header>

      {/* Mobile: faixa com a marca na mesma linha do hambúrguer. Altura fixa: é
          ela que centra a marca no mesmo eixo do botão fixo. Sticky (z abaixo do
          backdrop) pra descer junto com o botão no scroll. */}
      {marcaMobile && (
        <div
          className="md:hidden sticky top-0 z-[45] flex items-center justify-between"
          style={{
            backgroundColor: "#585a4f",
            height: FAIXA_MOBILE_ALTURA,
            padding: `0 ${FAIXA_MOBILE_PADDING}px`,
          }}
        >
          <Link href="/" className="flex items-center" aria-label="Morabilidade — início">
            <Image
              src="/logo-marca.png"
              alt="Morabilidade"
              width={1855}
              height={890}
              style={{ width: 104, height: "auto", objectFit: "contain" }}
              priority
            />
          </Link>
          {/* Espaço reservado pro botão fixo do hambúrguer */}
          <span style={{ width: BURGER, height: BURGER }} aria-hidden />
        </div>
      )}

      {/* Mobile floating hamburger (vira X com animação elástica) */}
      <button
        className="md:hidden fixed flex items-center justify-center active:scale-90"
        style={{
          top: marcaMobile ? BURGER_TOP_NA_FAIXA : 16,
          right: marcaMobile ? FAIXA_MOBILE_PADDING : 16,
          zIndex: 60,
          width: BURGER,
          height: BURGER,
          backgroundColor: "#d8cb6a",
          border: "2px solid rgba(252,252,252,0.85)",
          borderRadius: 12,
          cursor: "pointer",
          padding: 0,
          boxShadow: "0 4px 16px rgba(0,0,0,0.35), 0 0 0 4px rgba(216,203,106,0.18)",
          transition: "transform 0.2s ease",
        }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        <span className={`nav-burger ${open ? "is-open" : ""}`} aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>

      {/* Backdrop com blur — fecha ao tocar fora */}
      <div
        className={`md:hidden nav-backdrop ${open ? "is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Painel lateral em slide */}
      <aside
        id="mobile-menu"
        className={`md:hidden nav-drawer ${open ? "is-open" : ""}`}
        style={{ padding: "92px 28px 28px" }}
      >
        <span
          className="nav-drawer-item"
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#d8cb6a",
            marginBottom: 8,
            transitionDelay: open ? "80ms" : "0ms",
          }}
        >
          Navegação
        </span>
        <nav style={{ display: "flex", flexDirection: "column" }}>
          {links.map((link, i) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="nav-drawer-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "18px 0",
                  fontSize: 22,
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  color: active ? "#d8cb6a" : "#fcfcfc",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(252,252,252,0.08)",
                  fontWeight: active ? 600 : 400,
                  transitionDelay: open ? `${140 + i * 60}ms` : "0ms",
                }}
              >
                {active && (
                  <span
                    style={{
                      width: 4,
                      height: 24,
                      backgroundColor: "#d8cb6a",
                      borderRadius: 2,
                    }}
                  />
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/imoveis"
          onClick={() => setOpen(false)}
          className="nav-drawer-item"
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
            transitionDelay: open ? `${140 + links.length * 60}ms` : "0ms",
          }}
        >
          Ver imóveis <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Rodapé do painel */}
        <div
          className="nav-drawer-item"
          style={{
            marginTop: "auto",
            paddingTop: 24,
            borderTop: "1px solid rgba(252,252,252,0.08)",
            transitionDelay: open ? `${200 + links.length * 60}ms` : "0ms",
          }}
        >
          <a
            href="https://www.instagram.com/morabilidade"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "rgba(252,252,252,0.6)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            <Instagram className="w-[18px] h-[18px]" />
            @morabilidade
          </a>
        </div>
      </aside>
    </>
  );
}
