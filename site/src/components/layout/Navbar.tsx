"use client";

import { useEffect, useRef, useState } from "react";
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
export const NAVBAR_ALTURA = "clamp(82px, 10vw, 90px)";

// Modo transparente: a navbar troca pra sólida quando a base dela está a
// FOLGA_TEXTO px de encostar no texto do hero. O elemento de referência é o que
// tiver `data-nav-limite`; sem ele, cai no limite fixo.
const FOLGA_TEXTO = 24;
const LIMITE_PADRAO = 120;

// Faixa mobile com a marca (só a listagem usa). O hambúrguer é fixed pra seguir
// alcançável depois do scroll, então o `top` dele sai da altura da faixa — é
// isso que mantém marca e botão no mesmo eixo vertical.
const FAIXA_MOBILE_ALTURA = 68;
const FAIXA_MOBILE_PADDING = 20;
const BURGER = 48;
const BURGER_TOP_NA_FAIXA = (FAIXA_MOBILE_ALTURA - BURGER) / 2;
// O botão não tem mais fundo, só as 3 linhas (22px, ver .nav-burger no
// globals.css). O alvo de toque continua 48px, então descontamos a folga do
// `right` pra alinhar as linhas com a margem da página, e não a caixa invisível.
const BURGER_GLIFO = 22;
const BURGER_FOLGA = (BURGER - BURGER_GLIFO) / 2;

interface NavbarProps {
  /** Mostra a faixa com a marca no mobile, alinhada com o hambúrguer. */
  marcaMobile?: boolean;
  /**
   * Navbar transparente sobre o hero (home): começa sem fundo, com um leve
   * scrim pra legibilidade, e vira sólida (#585a4f) só quando a barra chega
   * perto do texto do hero (o elemento marcado com `data-nav-limite`).
   * Nas outras páginas fica o comportamento antigo (sticky sólida).
   */
  transparente?: boolean;
}

export function Navbar({ marcaMobile = false, transparente = false }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  // Modo transparente: o ponto de virada é onde a base da navbar quase encosta
  // no texto do hero. O hero é elástico (88vh), então esse ponto muda com a
  // altura da janela — por isso medimos em vez de cravar um número.
  useEffect(() => {
    if (!transparente) return;
    let vivo = true;
    let limite = LIMITE_PADRAO;

    const medir = () => {
      const alvo = document.querySelector<HTMLElement>("[data-nav-limite]");
      if (!alvo) return;
      const topoDoTexto = alvo.getBoundingClientRect().top + window.scrollY;
      const alturaNav = headerRef.current?.offsetHeight ?? 0;
      limite = Math.max(0, topoDoTexto - alturaNav - FOLGA_TEXTO);
    };

    const avaliar = () => setScrolled(window.scrollY > limite);
    const remedir = () => {
      if (!vivo) return;
      medir();
      avaliar();
    };

    remedir();
    // O hero é em serifada: quando a fonte carrega, o texto muda de lugar.
    document.fonts?.ready?.then(remedir);
    window.addEventListener("scroll", avaliar, { passive: true });
    window.addEventListener("resize", remedir);
    return () => {
      vivo = false;
      window.removeEventListener("scroll", avaliar);
      window.removeEventListener("resize", remedir);
    };
  }, [transparente]);

  const solida = !transparente || scrolled;

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
        ref={headerRef}
        className={`hidden md:block z-50 ${
          transparente ? "fixed top-0 left-0 right-0" : "sticky top-0"
        }`}
        style={{
          backgroundColor: solida ? "#585a4f" : "transparent",
          backgroundImage: solida
            ? "none"
            : "linear-gradient(180deg, rgba(20,22,18,0.45) 0%, rgba(20,22,18,0) 100%)",
          boxShadow: solida && transparente ? "0 8px 24px rgba(20,22,18,0.18)" : "none",
          transition: "background-color 0.3s ease, box-shadow 0.3s ease",
          height: NAVBAR_ALTURA,
        }}
      >
        <div
          className="flex items-center justify-between h-full"
          style={{ padding: "0 clamp(20px, 5vw, 48px)" }}
        >
          {/* Logo — usa o PNG recortado justo (`logo-marca`), e não o
              `Logo_fundoTransparente`: aquele tem ~59% de margem transparente
              na altura, o que encolhia a marca pra 41% do tamanho pedido. */}
          <Link href="/" className="flex-shrink-0 flex items-center">
            <Image
              src="/logo-marca.png"
              alt="Morabilidade"
              width={1855}
              height={890}
              style={{
                height: "clamp(40px, 5vw, 52px)",
                width: "auto",
                objectFit: "contain",
                filter: solida
                  ? "none"
                  : "drop-shadow(0 2px 8px rgba(0,0,0,0.45))",
              }}
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
                    textShadow: solida ? "none" : "0 1px 6px rgba(20,22,18,0.5)",
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
              style={{ width: 88, height: "auto", objectFit: "contain" }}
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
          right: (marcaMobile ? FAIXA_MOBILE_PADDING : 16) - BURGER_FOLGA,
          zIndex: 60,
          width: BURGER,
          height: BURGER,
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
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
