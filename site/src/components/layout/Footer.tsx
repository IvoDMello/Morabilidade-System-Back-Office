import Link from "next/link";
import Image from "next/image";
import { Instagram } from "lucide-react";

export function Footer() {
  const anosDeMarket = new Date().getFullYear() - 2010;

  return (
    <footer
      style={{ backgroundColor: "#585a4f" }}
      className="text-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(360px,1.4fr)_1fr] gap-10 md:gap-16 mb-12 md:items-center">

          {/* Páginas — esquerda */}
          <div className="text-center md:text-right order-2 md:order-1">
            <h4 className="font-semibold mb-5 text-xs uppercase tracking-widest" style={{ color: "#d8cb6a" }}>
              Páginas
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Início" },
                { href: "/imoveis", label: "Imóveis" },
                { href: "/sobre", label: "Sobre nós" },
                { href: "/contato", label: "Contato" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/75 hover:text-white transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Marca — centro */}
          <div className="flex flex-col items-center text-center order-1 md:order-2">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={360}
              height={100}
              className="object-contain mb-5"
              style={{ height: "auto", width: "clamp(200px, 26vw, 320px)" }}
            />
            <p className="text-white/75 text-sm leading-relaxed max-w-xs mb-6">
              Simples, eficiente e humanizada. Conectando pessoas ao imóvel certo
              há mais de uma década na Zona Sul do Rio de Janeiro.
            </p>

            {/* Anos de mercado */}
            <div className="inline-flex items-center gap-3 mb-6">
              <div
                className="flex flex-col items-center justify-center w-14 h-14 rounded-xl"
                style={{ backgroundColor: "rgba(216,203,106,0.18)", border: "1px solid rgba(216,203,106,0.45)" }}
              >
                <span className="text-2xl font-bold leading-none" style={{ color: "#d8cb6a" }}>
                  {anosDeMarket}
                </span>
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white/90">Anos de Mercado</p>
                <p className="text-xs text-white/60">Zona Sul · Rio de Janeiro</p>
              </div>
            </div>

            {/* Social */}
            <a
              href="https://www.instagram.com/morabilidade"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram @morabilidade"
              className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/25 text-white/70 hover:text-white hover:border-white/50 transition"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>

          {/* Portfólio — direita */}
          <div className="text-center md:text-left order-3">
            <h4 className="font-semibold mb-5 text-xs uppercase tracking-widest" style={{ color: "#d8cb6a" }}>
              Portfólio
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/imoveis?tipo_negocio=venda", label: "Imóveis à venda" },
                { href: "/imoveis?tipo_negocio=locacao", label: "Imóveis para locação" },
                { href: "/imoveis?tipo_imovel=apartamento", label: "Apartamentos" },
                { href: "/imoveis?tipo_imovel=casa", label: "Casas" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/75 hover:text-white transition"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Morabilidade. Todos os direitos reservados.
          </p>
          <p className="text-xs text-white/55 tracking-widest uppercase">
            Simples · Eficiente · Humanizada
          </p>
          <p className="text-xs text-white/55">CRECI-RJ nº 70411</p>
        </div>
      </div>
    </footer>
  );
}
