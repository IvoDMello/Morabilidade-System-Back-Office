import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#585a4f" }} className="text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Marca */}
          <div>
            <Image
              src="/logo.jpeg"
              alt="Morabilidade"
              width={160}
              height={44}
              className="object-contain mb-4"
            />
            <p className="text-white/70 text-sm leading-relaxed">
              Sua imobiliária de confiança. Encontre o imóvel ideal para comprar
              ou alugar com quem entende do mercado.
            </p>
          </div>

          {/* Navegação */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Navegação</h4>
            <ul className="space-y-2 text-sm text-white/70">
              {[
                { href: "/", label: "Início" },
                { href: "/imoveis", label: "Imóveis" },
                { href: "/sobre", label: "Sobre nós" },
                { href: "/contato", label: "Contato" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white transition">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Contato</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gold-400" style={{ color: "#d8cb6a" }} />
                <span>Rua Exemplo, 123 — Cidade, UF</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#d8cb6a" }} />
                <span>(00) 0000-0000</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#d8cb6a" }} />
                <span>contato@morabilidade.com.br</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Morabilidade. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
