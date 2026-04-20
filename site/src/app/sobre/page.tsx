import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Sobre nós",
  description: "Conheça a história e os valores da Morabilidade, sua imobiliária de confiança.",
};

const valores = [
  {
    icon: "🏆",
    title: "Excelência",
    desc: "Buscamos sempre oferecer o melhor atendimento e as melhores oportunidades do mercado.",
  },
  {
    icon: "🤝",
    title: "Transparência",
    desc: "Acreditamos em relações honestas e informações claras em todas as etapas do processo.",
  },
  {
    icon: "💡",
    title: "Conhecimento",
    desc: "Nossa equipe é especializada e está sempre atualizada com as tendências do mercado imobiliário.",
  },
  {
    icon: "❤️",
    title: "Cuidado",
    desc: "Tratamos cada cliente como único, entendendo suas necessidades e objetivos.",
  },
];

export default function SobrePage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="py-16 px-4 text-center" style={{ backgroundColor: "#585a4f" }}>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Sobre a Morabilidade
        </h1>
        <p className="text-white/70 max-w-xl mx-auto">
          Mais de [X] anos conectando pessoas aos imóveis certos.
        </p>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* Nossa história */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Nossa história</h2>
            <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
              <p>
                A Morabilidade nasceu da paixão por conectar pessoas ao lugar certo para viver
                ou investir. Fundada em [ano], a imobiliária cresceu com base em atendimento
                personalizado e profundo conhecimento do mercado local.
              </p>
              <p>
                Ao longo dos anos, ajudamos centenas de famílias e investidores a realizarem
                o sonho da casa própria ou a encontrarem o imóvel comercial ideal.
              </p>
              <p>
                Hoje, contamos com um portfólio diversificado de imóveis e uma equipe dedicada
                a tornar cada transação simples, segura e satisfatória.
              </p>
            </div>
          </div>
          <div
            className="rounded-2xl h-64 flex items-center justify-center text-white/20 text-sm"
            style={{ backgroundColor: "#585a4f" }}
          >
            {/* Substitua por uma imagem real da equipe ou escritório */}
            <div className="text-center">
              <Image
                src="/logo.jpeg"
                alt="Morabilidade"
                width={180}
                height={50}
                className="object-contain opacity-60"
              />
            </div>
          </div>
        </section>

        {/* Nossos valores */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
            Nossos valores
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {valores.map((v) => (
              <div
                key={v.title}
                className="flex items-start gap-4 bg-white border border-slate-100 rounded-xl p-5 shadow-sm"
              >
                <span className="text-3xl flex-shrink-0">{v.icon}</span>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">{v.title}</h3>
                  <p className="text-slate-500 text-sm">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Números */}
        <section
          className="rounded-2xl py-12 px-8 text-center"
          style={{ backgroundColor: "#585a4f" }}
        >
          <h2 className="text-2xl font-bold text-white mb-10">Morabilidade em números</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num: "[X]+", label: "Anos de mercado" },
              { num: "[X]+", label: "Imóveis negociados" },
              { num: "[X]+", label: "Clientes satisfeitos" },
              { num: "[X]+", label: "Corretores especializados" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-3xl font-bold" style={{ color: "#d8cb6a" }}>
                  {item.num}
                </p>
                <p className="text-white/70 text-sm mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Pronto para encontrar seu imóvel?
          </h2>
          <p className="text-slate-500 mb-8">
            Nossa equipe está à disposição para ajudar você em cada passo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/imoveis"
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f" }}
            >
              Ver imóveis <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contato"
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold border-2 transition hover:bg-slate-50"
              style={{ borderColor: "#585a4f", color: "#585a4f" }}
            >
              Falar com corretor
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
