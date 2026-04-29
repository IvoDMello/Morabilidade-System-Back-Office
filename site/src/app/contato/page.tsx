import type { Metadata } from "next";
import { Instagram, MapPin, MessageCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a equipe da Morabilidade pelo WhatsApp ou Instagram. Imobiliária 100% digital, atendendo a Zona Sul do Rio de Janeiro.",
};

const NUMERO_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP ?? "";
const INSTAGRAM = "https://www.instagram.com/morabilidade";

interface Props {
  searchParams: Promise<{ imovel?: string }>;
}

export default async function ContatoPage({ searchParams }: Props) {
  const { imovel } = await searchParams;

  const mensagem = imovel
    ? `Olá! Tenho interesse no imóvel de código ${imovel}. Pode me dar mais informações?`
    : "Olá! Gostaria de falar com a equipe da Morabilidade.";

  const hrefWhatsapp = NUMERO_WHATSAPP
    ? `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensagem)}`
    : INSTAGRAM;

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="py-12 px-4 text-center" style={{ backgroundColor: "#585a4f" }}>
        <h1 className="text-3xl font-bold text-white mb-2">Fale com a gente</h1>
        <p className="text-white/70">
          Atendimento direto pelo WhatsApp ou Instagram.
        </p>
      </section>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="space-y-6">

          {imovel && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              Você quer falar sobre o imóvel <strong className="font-mono">{imovel}</strong>.
              Já incluímos isso na mensagem do WhatsApp.
            </div>
          )}

          {/* WhatsApp — canal principal */}
          <a
            href={hrefWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl p-6 transition hover:shadow-lg"
            style={{ backgroundColor: "#25D366" }}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                  Canal recomendado
                </p>
                <p className="text-xl font-bold text-white mt-1">Conversar pelo WhatsApp</p>
                <p className="text-white/85 text-sm mt-1">
                  Resposta rápida — atendimento humano em horário comercial
                </p>
              </div>
            </div>
          </a>

          {/* Instagram */}
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl p-5 transition hover:shadow-md"
            style={{ backgroundColor: "#585a4f" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#d8cb6a" }}
              >
                <Instagram className="w-5 h-5" style={{ color: "#585a4f" }} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">@morabilidade</p>
                <p className="text-white/60 text-xs mt-0.5">
                  Acompanhe os lançamentos e mande DM
                </p>
              </div>
            </div>
          </a>

          {/* Área de atuação */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#f5f5f3" }}
            >
              <MapPin className="w-4 h-4" style={{ color: "#585a4f" }} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Área de atuação</p>
              <p className="text-sm font-medium text-slate-800">
                Zona Sul · Rio de Janeiro · RJ
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 pt-4">
            Imobiliária 100% digital — sem sede física. Todo o atendimento é online.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}
