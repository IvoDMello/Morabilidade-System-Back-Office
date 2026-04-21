import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContatoForm } from "@/components/contato/ContatoForm";

export const metadata: Metadata = {
  title: "Contato",
  description: "Entre em contato com a equipe da Morabilidade. Estamos prontos para ajudar você a encontrar o imóvel ideal.",
};

const infoItems = [
  { icon: MapPin, label: "Endereço", value: "Rua Exemplo, 123 — Cidade, UF" },
  { icon: Phone, label: "Telefone", value: "(00) 0000-0000" },
  { icon: Mail, label: "E-mail", value: "contato@morabilidade.com.br" },
  { icon: Clock, label: "Horário", value: "Seg–Sex 09h–18h · Sáb 09h–13h" },
];

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
          Preencha o formulário ou utilize um dos canais abaixo.
        </p>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* Informações de contato */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Como nos encontrar</h2>
              <p className="text-slate-500 text-sm">
                Nossa equipe está disponível para esclarecer dúvidas e agendar visitas.
              </p>
            </div>

            <ul className="space-y-4">
              {infoItems.map(({ icon: Icon, label, value }) => (
                <li key={label} className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#d8cb6a" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: "#585a4f" }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-medium text-slate-800">{value}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Mapa placeholder — substitua pelo embed real */}
            <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 h-52 flex items-center justify-center text-slate-300 text-sm">
              <a
                href="https://www.google.com/maps/search/?api=1&query=Rua+Exemplo+123"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition"
              >
                <MapPin className="w-8 h-8" />
                Ver no Google Maps
              </a>
            </div>
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
