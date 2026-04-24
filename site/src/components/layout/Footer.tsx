import Link from "next/link";
import Image from "next/image";
import { Instagram } from "lucide-react";

export function Footer() {
  const anosDeMarket = new Date().getFullYear() - 2010;

  return (
    <footer
      style={{ background: "linear-gradient(180deg, #3d3f36 0%, #2e302a 100%)" }}
      className="text-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">

          {/* Marca */}
          <div className="md:col-span-5">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={140}
              height={38}
              className="object-contain mb-5"
            />
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">
              Simples, eficiente e humanizada. Conectando pessoas ao imóvel certo
              há mais de uma década na Zona Sul do Rio de Janeiro.
            </p>

            {/* Anos de mercado */}
            <div className="inline-flex items-center gap-3 mb-6">
              <div
                className="flex flex-col items-center justify-center w-14 h-14 rounded-xl"
                style={{ backgroundColor: "rgba(216,203,106,0.12)", border: "1px solid rgba(216,203,106,0.25)" }}
              >
                <span className="text-2xl font-bold leading-none" style={{ color: "#d8cb6a" }}>
                  {anosDeMarket}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/80">Anos de Mercado</p>
                <p className="text-xs text-white/40">Zona Sul · Rio de Janeiro</p>
              </div>
            </div>

            {/* Social */}
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/morabilidade"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @morabilidade"
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navegação */}
          <div className="md:col-span-3 md:col-start-7">
            <h4 className="font-semibold mb-5 text-xs text-white/50 uppercase tracking-widest">
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
                    className="text-sm text-white/50 hover:text-white transition flex items-center gap-1.5 group"
                  >
                    <span
                      className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                      style={{ backgroundColor: "#d8cb6a" }}
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Portfólio */}
          <div className="md:col-span-3 md:col-start-10">
            <h4 className="font-semibold mb-5 text-xs text-white/50 uppercase tracking-widest">
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
                    className="text-sm text-white/50 hover:text-white transition flex items-center gap-1.5 group"
                  >
                    <span
                      className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                      style={{ backgroundColor: "#d8cb6a" }}
                    />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} Morabilidade. Todos os direitos reservados.
          </p>
          <p className="text-xs text-white/20 tracking-widest uppercase">
            Simples · Eficiente · Humanizada
          </p>
          <p className="text-xs text-white/20">CRECI-RJ nº 70411</p>
        </div>
      </div>
    </footer>
  );
}
