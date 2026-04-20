import Link from "next/link";
import { ArrowRight, Building2, Search, Phone } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ImovelCard } from "@/components/imoveis/ImovelCard";
import { getImoveisDisponiveis } from "@/lib/api";

export default async function HomePage() {
  const { data: destaques, total } = await getImoveisDisponiveis({
    page_size: "6",
  }).catch(() => ({ data: [], total: 0 }));

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section
        className="relative py-20 sm:py-28 px-4"
        style={{ backgroundColor: "#585a4f" }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">
            Encontre o imóvel{" "}
            <span style={{ color: "#d8cb6a" }}>ideal para você</span>
          </h1>
          <p className="text-white/70 text-lg mb-10">
            Casas, apartamentos e muito mais disponíveis para venda e locação.
          </p>

          {/* Busca rápida */}
          <form
            action="/imoveis"
            method="get"
            className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto"
          >
            <select
              name="tipo_negocio"
              className="flex-shrink-0 px-4 py-3 rounded-lg text-sm border-0 bg-white text-slate-800 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": "#d8cb6a" } as React.CSSProperties}
            >
              <option value="">Comprar ou alugar?</option>
              <option value="venda">Comprar</option>
              <option value="locacao">Alugar</option>
            </select>
            <select
              name="tipo_imovel"
              className="flex-shrink-0 px-4 py-3 rounded-lg text-sm border-0 bg-white text-slate-800 focus:outline-none"
            >
              <option value="">Tipo de imóvel</option>
              <option value="casa">Casa</option>
              <option value="apartamento">Apartamento</option>
              <option value="terreno">Terreno</option>
              <option value="sala">Sala comercial</option>
              <option value="kitnet">Kitnet / Studio</option>
            </select>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition hover:opacity-90"
              style={{ backgroundColor: "#d8cb6a", color: "#585a4f" }}
            >
              <Search className="w-4 h-4" /> Buscar
            </button>
          </form>
        </div>
      </section>

      {/* ── Imóveis em destaque ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Imóveis disponíveis
            </h2>
            <p className="text-slate-500 mt-1">
              {total > 0
                ? `${total} imóvel${total !== 1 ? "is" : ""} cadastrado${total !== 1 ? "s" : ""}`
                : "Veja nossas opções"}
            </p>
          </div>
          <Link
            href="/imoveis"
            className="flex items-center gap-1.5 text-sm font-semibold transition hover:opacity-80"
            style={{ color: "#585a4f" }}
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {destaques.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destaques.map((imovel) => (
              <ImovelCard key={imovel.id} imovel={imovel} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum imóvel disponível no momento.</p>
          </div>
        )}

        {destaques.length > 0 && (
          <div className="text-center mt-10">
            <Link
              href="/imoveis"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-sm transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f", color: "#fff" }}
            >
              Ver todos os imóveis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {/* ── Por que a Morabilidade ── */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
            Por que escolher a Morabilidade?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🏡",
                title: "Amplo portfólio",
                desc: "Dezenas de imóveis disponíveis para venda e locação nas melhores regiões.",
              },
              {
                icon: "🤝",
                title: "Atendimento personalizado",
                desc: "Nossa equipe está pronta para entender suas necessidades e encontrar o imóvel certo.",
              },
              {
                icon: "⚡",
                title: "Processo ágil",
                desc: "Da visita à assinatura, cuidamos de toda a burocracia para você.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-center"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Contato ── */}
      <section
        className="py-16 px-4 text-center"
        style={{ backgroundColor: "#d8cb6a" }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "#585a4f" }}>
          Não encontrou o que procura?
        </h2>
        <p className="mb-8 text-sm sm:text-base" style={{ color: "#585a4f" }}>
          Fale com nossa equipe e deixe que encontramos o imóvel ideal para você.
        </p>
        <Link
          href="/contato"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-sm text-white transition hover:opacity-90"
          style={{ backgroundColor: "#585a4f" }}
        >
          <Phone className="w-4 h-4" /> Falar com corretor
        </Link>
      </section>

      <Footer />
    </>
  );
}
