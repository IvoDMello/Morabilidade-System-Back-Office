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

/** Altura da navbar por variante, para alinhar os elementos sticky da página. */
export const NAVBAR_ALTURA = {
  escura: "clamp(96px, 12vw, 104px)",
  clara: 78,
} as const;

// Faixa mobile da variante clara. O hambúrguer é fixed (continua alcançável
// depois do scroll), então o `top` dele é calculado a partir da altura da faixa
// pra que os dois fiquem no mesmo eixo vertical.
const FAIXA_MOBILE_ALTURA = 78;
const FAIXA_MOBILE_PADDING = 20;
const BURGER_CLARO = 42;
const BURGER_CLARO_TOP = (FAIXA_MOBILE_ALTURA - BURGER_CLARO) / 2;

interface NavbarProps {
  /**
   * "escura" é o padrão do site (faixa oliva). "clara" é o header do redesign,
   * usado só na listagem de imóveis.
   */
  variante?: "escura" | "clara";
}

export function Navbar({ variante = "escura" }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const clara = variante === "clara";

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
        style={
          clara
            ? {
                backgroundColor: "#f6f4ec",
                height: NAVBAR_ALTURA.clara,
                borderBottom: "1px solid rgba(86,87,70,0.14)",
              }
            : { backgroundColor: "#585a4f", height: NAVBAR_ALTURA.escura }
        }
      >
        <div
          className="flex items-center justify-between h-full"
          style={{ padding: "0 clamp(20px, 5vw, 48px)" }}
        >
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <Image
              src={clara ? "/logo-marca-clara.png" : "/Logo_fundoTransparente.png"}
              alt="Morabilidade"
              width={clara ? 1855 : 220}
              height={clara ? 890 : 64}
              style={
                clara
                  ? { width: 146, height: "auto", objectFit: "contain" }
                  : {
                      height: "clamp(68px, 10vw, 76px)",
                      width: "auto",
                      objectFit: "contain",
                    }
              }
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
                    color: clara
                      ? active
                        ? "#3c3d2e"
                        : "rgba(60,61,46,0.75)"
                      : active
                        ? "#d8cb6a"
                        : "rgba(252,252,252,0.65)",
                    textDecoration: "none",
                    paddingBottom: 6,
                    transition: "color 0.15s",
                    fontWeight: active ? 600 : 400,
                    letterSpacing: active ? "0.02em" : "0",
                  }}
                  className={clara ? "hover:!text-[#3c3d2e]" : "hover:!text-[#fcfcfc]"}
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
                        backgroundColor: clara ? "#b9a53a" : "#d8cb6a",
                        borderRadius: 1,
                      }}
                    />
                  )}
                </Link>
              );
            })}
            <div
              style={{
                width: 1,
                height: 18,
                backgroundColor: clara ? "rgba(86,87,70,0.25)" : "rgba(252,252,252,0.18)",
              }}
            />
            <a
              href="https://www.instagram.com/morabilidade"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @morabilidade"
              style={{
                color: clara ? "rgba(60,61,46,0.8)" : "rgba(252,252,252,0.6)",
                display: "flex",
                alignItems: "center",
              }}
              className={
                clara
                  ? "hover:!text-[#3c3d2e] transition-colors"
                  : "hover:!text-[#fcfcfc] transition-colors"
              }
            >
              <Instagram className="w-[18px] h-[18px]" />
            </a>
            <Link
              href="/imoveis"
              style={
                clara
                  ? {
                      backgroundColor: "#565746",
                      color: "#f0eee1",
                      fontWeight: 600,
                      padding: "10px 20px",
                      borderRadius: 10,
                      fontSize: 14,
                      textDecoration: "none",
                      letterSpacing: "0.01em",
                      transition: "opacity 0.15s",
                    }
                  : {
                      backgroundColor: "#d8cb6a",
                      color: "#3e4037",
                      fontWeight: 700,
                      padding: "7px 16px",
                      borderRadius: 6,
                      fontSize: 13,
                      textDecoration: "none",
                      letterSpacing: "0.01em",
                      transition: "opacity 0.15s",
                    }
              }
              className="hover:opacity-90"
            >
              Ver imóveis
            </Link>
          </nav>

        </div>
      </header>

      {/* Mobile (variante clara): faixa com a marca na mesma linha do hambúrguer.
          Altura fixa: é ela que centra a marca no mesmo eixo do botão fixo.
          Sticky (z abaixo do backdrop) pra descer junto com o botão no scroll. */}
      {clara && (
        <div
          className="md:hidden sticky top-0 z-[45] flex items-center justify-between"
          style={{
            backgroundColor: "#f6f4ec",
            borderBottom: "1px solid rgba(86,87,70,0.14)",
            height: FAIXA_MOBILE_ALTURA,
            padding: `0 ${FAIXA_MOBILE_PADDING}px`,
          }}
        >
          <Link href="/" className="flex items-center" aria-label="Morabilidade — início">
            <Image
              src="/logo-marca-clara.png"
              alt="Morabilidade"
              width={1855}
              height={890}
              style={{ width: 104, height: "auto", objectFit: "contain" }}
              priority
            />
          </Link>
          {/* Espaço reservado pro botão fixo do hambúrguer */}
          <span style={{ width: BURGER_CLARO, height: BURGER_CLARO }} aria-hidden />
        </div>
      )}

      {/* Mobile floating hamburger (vira X com animação elástica).
          Na variante clara ele nasce discreto e assume o dourado ao abrir, pra
          combinar com o painel lateral. */}
      <button
        className="md:hidden fixed flex items-center justify-center active:scale-90"
        style={{
          top: clara ? BURGER_CLARO_TOP : 16,
          right: clara ? FAIXA_MOBILE_PADDING : 16,
          zIndex: 60,
          width: clara ? BURGER_CLARO : 48,
          height: clara ? BURGER_CLARO : 48,
          borderRadius: 12,
          cursor: "pointer",
          padding: 0,
          transition: "transform 0.2s ease, background-color 0.25s ease, border-color 0.25s ease",
          ...(clara && !open
            ? {
                backgroundColor: "transparent",
                border: "1px solid rgba(86,87,70,0.3)",
                boxShadow: "none",
              }
            : {
                backgroundColor: "#d8cb6a",
                border: "2px solid rgba(252,252,252,0.85)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.35), 0 0 0 4px rgba(216,203,106,0.18)",
              }),
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
