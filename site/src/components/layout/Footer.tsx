import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Instagram, Facebook } from "lucide-react";

export function Footer() {
  return (
    <footer
      style={{ background: "linear-gradient(180deg, #3d3f36 0%, #2e302a 100%)" }}
      className="text-white"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
          {/* Marca */}
          <div className="md:col-span-4">
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={160}
              height={44}
              className="object-contain mb-5"
            />
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Sua imobiliária de confiança. Encontre o imóvel ideal para comprar
              ou alugar com quem entende do mercado.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              <a
                href="https://www.instagram.com/morabilidade"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @morabilidade"
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition"
              >
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Navegação */}
          <div className="md:col-span-3 md:col-start-6">
            <h4 className="font-semibold mb-5 text-sm text-white/80 uppercase tracking-widest">
              Navegação
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
                    <span className="w-1 h-1 rounded-full bg-gold-400 opacity-0 group-hover:opacity-100 transition" style={{ backgroundColor: "#d8cb6a" }} />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div className="md:col-span-3 md:col-start-10">
            <h4 className="font-semibold mb-5 text-sm text-white/80 uppercase tracking-widest">
              Contato
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#d8cb6a" }} />
                <span className="text-sm text-white/50 leading-relaxed">
                  Rua Exemplo, 123<br />Cidade, UF
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#d8cb6a" }} />
                <span className="text-sm text-white/50">(00) 0000-0000</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#d8cb6a" }} />
                <span className="text-sm text-white/50">contato@morabilidade.com.br</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} Morabilidade. Todos os direitos reservados.
          </p>
          <p className="text-xs text-white/20">CRECI nº 000000</p>
        </div>
      </div>
    </footer>
  );
}
