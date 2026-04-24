import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle, Instagram, MessageCircle, Search, CalendarCheck, KeyRound } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Sobre nós",
  description:
    "Conheça a Morabilidade — imobiliária 100% digital, presente no Instagram e WhatsApp, conectando pessoas ao imóvel certo com agilidade e transparência.",
};

const diferenciais = [
  {
    titulo: "100% digital",
    desc: "Sem sede física, sem burocracia desnecessária. Todo o processo — da busca ao fechamento — acontece de forma ágil e online.",
  },
  {
    titulo: "Atendimento personalizado",
    desc: "Cada cliente recebe atenção individual. Entendemos seu perfil, seus objetivos e apresentamos apenas os imóveis que fazem sentido para você.",
  },
  {
    titulo: "Agilidade via WhatsApp",
    desc: "Dúvidas, propostas e agendamentos resolvidos em minutos. Nossa equipe responde no mesmo dia, sem filas nem espera.",
  },
  {
    titulo: "Curadoria de imóveis",
    desc: "Selecionamos e verificamos cada imóvel antes de publicar. Você vê apenas opções reais, com informações completas e fotos atualizadas.",
  },
  {
    titulo: "Transparência total",
    desc: "Valores, condições e documentação apresentados com clareza desde o primeiro contato. Sem surpresas no processo.",
  },
  {
    titulo: "Comunidade engajada",
    desc: "Com mais de 90 mil seguidores no Instagram, somos referência em conteúdo imobiliário e alcançamos compradores e locatários ativos.",
  },
];

const etapas = [
  {
    icon: MessageCircle,
    numero: "01",
    titulo: "Entre em contato",
    desc: "Fale conosco pelo WhatsApp ou nos envie uma mensagem pelo Instagram. A conversa começa de forma simples e sem compromisso.",
  },
  {
    icon: Search,
    numero: "02",
    titulo: "Entendemos seu perfil",
    desc: "Conversamos sobre o que você busca: localização, tipo de imóvel, faixa de preço e suas prioridades. Sem questionários longos.",
  },
  {
    icon: CheckCircle,
    numero: "03",
    titulo: "Selecionamos as melhores opções",
    desc: "Com base no seu perfil, apresentamos imóveis que realmente fazem sentido para você — sem perda de tempo com opções fora do seu interesse.",
  },
  {
    icon: CalendarCheck,
    numero: "04",
    titulo: "Agendamos a visita",
    desc: "Organizamos tudo para a visita ao imóvel no horário mais conveniente para você, acompanhado pela nossa equipe.",
  },
  {
    icon: KeyRound,
    numero: "05",
    titulo: "Negociação e fechamento",
    desc: "Assessoramos a proposta, negociação e toda a documentação até a entrega das chaves. Com segurança e transparência do início ao fim.",
  },
];

const depoimentos = [
  {
    nome: "Mariana Costa",
    cidade: "São Paulo, SP",
    texto:
      "A Morabilidade me ajudou a encontrar o apartamento ideal em menos de duas semanas. O atendimento foi extremamente ágil e personalizado — parecia que eles realmente entendiam o que eu precisava.",
    inicial: "M",
  },
  {
    nome: "Rafael Mendonça",
    cidade: "Campinas, SP",
    texto:
      "Procurei um imóvel para investimento e a equipe foi incrível: trouxeram opções certeiras, sem enrolação. Todo o processo pelo WhatsApp, super prático. Recomendo sem hesitar.",
    inicial: "R",
  },
  {
    nome: "Juliana e Pedro Alves",
    cidade: "Jundiaí, SP",
    texto:
      "Encontramos nossa primeira casa pela Morabilidade. Foram pacientes, transparentes e estiveram presentes em cada etapa. Fechamos o negócio com total segurança.",
    inicial: "J",
  },
];

export default function SobrePage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section
        className="py-20 px-4 text-center relative overflow-hidden"
        style={{ backgroundColor: "#585a4f" }}
      >
        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#d8cb6a" }}>
          Sobre nós
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
          Imobiliária feita para o<br className="hidden sm:block" /> mundo digital
        </h1>
        <p className="text-white/70 max-w-xl mx-auto text-base leading-relaxed">
          A Morabilidade nasceu digital e cresceu conectando pessoas ao imóvel certo — com agilidade, transparência e atendimento humano.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <a
            href="https://www.instagram.com/morabilidade"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white/80 border border-white/20 hover:border-white/40 transition"
          >
            <Instagram className="w-4 h-4" />
            @morabilidade · 90k seguidores
          </a>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">

        {/* Nossa história */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Nossa história</h2>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
              <p>
                A Morabilidade surgiu com uma proposta diferente: oferecer uma experiência
                imobiliária completamente digital, sem burocracia e sem a necessidade de uma
                sede física. Desde o início, apostamos nas redes sociais e no WhatsApp como
                nossos principais canais de atendimento.
              </p>
              <p>
                O que começou como uma nova forma de conectar compradores e locatários a imóveis
                de qualidade se tornou uma comunidade ativa de mais de 90 mil pessoas no Instagram,
                que acompanham lançamentos, dicas de mercado e oportunidades exclusivas.
              </p>
              <p>
                Hoje, ajudamos centenas de famílias e investidores a encontrar o imóvel ideal —
                com agilidade, curadoria cuidadosa e um atendimento que respeita o seu tempo.
              </p>
            </div>
          </div>
          <div
            className="rounded-2xl h-64 flex items-center justify-center"
            style={{ backgroundColor: "#f0ede6" }}
          >
            <div className="text-center">
              <Image
                src="/logo.jpeg"
                alt="Morabilidade"
                width={200}
                height={56}
                className="object-contain"
              />
              <p className="text-xs text-slate-400 mt-4">Imobiliária 100% digital</p>
            </div>
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
              { num: "500+", label: "Imóveis negociados" },
              { num: "90k+", label: "Seguidores no Instagram" },
              { num: "98%", label: "Clientes satisfeitos" },
              { num: "70411", label: "CRECI-RJ" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-4xl font-bold" style={{ color: "#d8cb6a" }}>
                  {item.num}
                </p>
                <p className="text-white/70 text-sm mt-2">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Diferenciais */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Por que escolher a Morabilidade?</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
              Combinamos tecnologia, atendimento humano e profundo conhecimento do mercado.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {diferenciais.map((d) => (
              <div
                key={d.titulo}
                className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="w-2 h-2 rounded-full mb-3" style={{ backgroundColor: "#d8cb6a" }} />
                <h3 className="font-semibold text-slate-800 mb-1.5 text-sm">{d.titulo}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Como funciona */}
        <section>
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900">Como funciona o atendimento</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
              Um processo simples, transparente e pensado para respeitar o seu tempo.
            </p>
          </div>
          <div className="space-y-0">
            {etapas.map((etapa, index) => {
              const Icon = etapa.icon;
              const isLast = index === etapas.length - 1;
              return (
                <div key={etapa.numero} className="flex gap-6 relative">
                  {/* Linha vertical */}
                  {!isLast && (
                    <div
                      className="absolute left-5 top-12 w-0.5 h-full -translate-x-1/2"
                      style={{ backgroundColor: "#e2dfd8" }}
                    />
                  )}
                  {/* Ícone */}
                  <div className="flex-shrink-0 relative z-10">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#585a4f" }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  {/* Conteúdo */}
                  <div className={`pb-10 ${isLast ? "pb-0" : ""}`}>
                    <p className="text-xs font-mono font-semibold mb-0.5" style={{ color: "#d8cb6a" }}>
                      {etapa.numero}
                    </p>
                    <h3 className="font-semibold text-slate-800 mb-1">{etapa.titulo}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-md">{etapa.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Depoimentos */}
        <section>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">O que nossos clientes dizem</h2>
            <p className="text-slate-500 text-sm mt-2">
              Histórias reais de quem encontrou o imóvel certo com a Morabilidade.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {depoimentos.map((dep) => (
              <div
                key={dep.nome}
                className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm flex flex-col gap-4"
              >
                <p className="text-slate-600 text-sm leading-relaxed flex-1">
                  &ldquo;{dep.texto}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: "#585a4f" }}
                  >
                    {dep.inicial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{dep.nome}</p>
                    <p className="text-xs text-slate-400">{dep.cidade}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Pronto para encontrar seu imóvel?
          </h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm">
            Nossa equipe está à disposição para ajudar você em cada etapa, do primeiro contato à entrega das chaves.
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
              Falar com a equipe
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
