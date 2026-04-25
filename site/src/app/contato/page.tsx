import type { Metadata } from "next";
import { Instagram, Mail, MapPin } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContatoForm } from "@/components/contato/ContatoForm";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com a equipe da Morabilidade. Atendemos a Zona Sul do Rio de Janeiro pelo Instagram, e-mail e mensagem direta.",
};

// E-mail de contato — substitua pela conta oficial quando definida.
const EMAIL_CONTATO = process.env.NEXT_PUBLIC_EMAIL_CONTATO ?? "";

interface Props {
  searchParams: Promise<{ imovel?: string }>;
}

export default async function ContatoPage({ searchParams }: Props) {
  const { imovel } = await searchParams;

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="py-12 px-4 text-center" style={{ backgroundColor: "#585a4f" }}>
        <h1 className="text-3xl font-bold text-white mb-2">Fale com a gente</h1>
        <p className="text-white/70">
          A forma mais rápida de nos encontrar é pelo Instagram.
        </p>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Informações de contato */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Como nos encontrar</h2>
              <p className="text-slate-500 text-sm">
                Imobiliária 100% digital. Nosso atendimento é online — pelo Instagram, mensagem direta no formulário ou e-mail.
              </p>
            </div>

            {/* Instagram em destaque (canal principal) */}
            <a
              href="https://www.instagram.com/morabilidade"
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl p-5 transition hover:shadow-md"
              style={{ backgroundColor: "#585a4f" }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#d8cb6a" }}
                >
                  <Instagram className="w-5 h-5" style={{ color: "#585a4f" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#d8cb6a" }}>
                    Canal principal
                  </p>
                  <p className="text-base font-semibold text-white mt-0.5">@morabilidade</p>
                  <p className="text-white/60 text-xs mt-1">
                    Resposta rápida pela DM · 90k+ seguidores
                  </p>
                </div>
              </div>
            </a>

            {/* E-mail (se configurado) e cobertura */}
            <ul className="space-y-4">
              {EMAIL_CONTATO && (
                <li className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#f5f5f3" }}
                  >
                    <Mail className="w-4 h-4" style={{ color: "#585a4f" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">E-mail</p>
                    <a
                      href={`mailto:${EMAIL_CONTATO}`}
                      className="text-sm font-medium text-slate-800 hover:underline break-all"
                    >
                      {EMAIL_CONTATO}
                    </a>
                  </div>
                </li>
              )}
              <li className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#f5f5f3" }}
                >
                  <MapPin className="w-4 h-4" style={{ color: "#585a4f" }} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Área de atuação</p>
                  <p className="text-sm font-medium text-slate-800">Zona Sul · Rio de Janeiro · RJ</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Formulário */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Envie uma mensagem</h2>
            <ContatoForm codigoImovel={imovel} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
