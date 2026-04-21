import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Search,
  Phone,
  Briefcase,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";
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
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #2e302a 0%, #585a4f 55%, #4a4d43 100%)" }}>
        {/* Decorative pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        {/* Decorative glow */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: "#d8cb6a" }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: "#d8cb6a" }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
            style={{ borderColor: "rgba(216,203,106,0.4)", color: "#d8cb6a", backgroundColor: "rgba(216,203,106,0.08)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#d8cb6a" }} />
            Imobiliária de confiança
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            Encontre o imóvel{" "}
            <em className="not-italic" style={{ color: "#d8cb6a" }}>
              ideal para você
            </em>
          </h1>
          <p className="text-white/60 text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Casas, apartamentos e muito mais disponíveis para venda e locação
            nas melhores regiões.
          </p>

          {/* Quick search card */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 max-w-2xl mx-auto">
            <form
              action="/imoveis"
              method="get"
              className="flex flex-col sm:flex-row gap-2"
            >
              <select
                name="tipo_negocio"
                className="flex-1 px-4 py-3 rounded-xl text-sm bg-white text-slate-800 border-0 focus:outline-none focus:ring-2 focus:ring-gold-400 cursor-pointer"
              >
                <option value="">Comprar ou alugar?</option>
                <option value="venda">Comprar</option>
                <option value="locacao">Alugar</option>
              </select>
              <select
                name="tipo_imovel"
                className="flex-1 px-4 py-3 rounded-xl text-sm bg-white text-slate-800 border-0 focus:outline-none focus:ring-2 focus:ring-gold-400 cursor-pointer"
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
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:shadow-lg whitespace-nowrap"
                style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
              >
                <Search className="w-4 h-4" />
                Buscar imóvel
              </button>
            </form>
          </div>

          {/* Stats row */}
          {total > 0 && (
            <p className="mt-8 text-white/40 text-xs">
              {total} imóve{total !== 1 ? "is" : "l"} disponíve{total !== 1 ? "is" : "l"} agora
            </p>
          )}
        </div>
      </section>

      {/* ── Imóveis em destaque ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#d8cb6a" }}>
              Portfólio
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-olive-900">
              Imóveis disponíveis
            </h2>
            {total > 0 && (
              <p className="text-slate-400 mt-1 text-sm">
                {total} imóve{total !== 1 ? "is" : "l"} cadastrado{total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link
            href="/imoveis"
            className="group flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80"
            style={{ color: "#585a4f" }}
          >
            Ver todos
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {destaques.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {destaques.map((imovel) => (
              <ImovelCard key={imovel.id} imovel={imovel} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-slate-300 border border-dashed border-slate-200 rounded-2xl">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-slate-400 text-sm">Nenhum imóvel disponível no momento.</p>
          </div>
        )}

        {destaques.length > 0 && (
          <div className="text-center mt-12">
            <Link
              href="/imoveis"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:shadow-lg"
              style={{ backgroundColor: "#585a4f", color: "#fff" }}
            >
              Ver todos os imóveis
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {/* ── Divisor decorativo ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <hr className="border-slate-200" />
      </div>

      {/* ── Por que a Morabilidade ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#d8cb6a" }}>
            Diferenciais
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-olive-900">
            Por que escolher a Morabilidade?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              Icon: Briefcase,
              title: "Amplo portfólio",
              desc: "Dezenas de imóveis disponíveis para venda e locação nas melhores regiões.",
            },
            {
              Icon: Users,
              title: "Atendimento personalizado",
              desc: "Nossa equipe está pronta para entender suas necessidades e encontrar o imóvel certo.",
            },
            {
              Icon: Zap,
              title: "Processo ágil",
              desc: "Da visita à assinatura, cuidamos de toda a burocracia para você.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group relative bg-white rounded-2xl p-8 border border-slate-100 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                style={{ backgroundColor: "#f5f5f3" }}
              >
                <item.Icon className="w-6 h-6" style={{ color: "#585a4f" }} />
              </div>
              <h3 className="font-semibold text-slate-800 text-lg mb-2">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              <div
                className="absolute bottom-0 left-8 right-8 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: "#d8cb6a" }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Contato ── */}
      <section className="mx-4 sm:mx-6 lg:mx-8 mb-20 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #2e302a 0%, #585a4f 100%)" }}>
        <div className="relative px-8 py-16 sm:px-16 text-center overflow-hidden">
          {/* Decorative dots */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#d8cb6a" }}>
              Fale conosco
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-4">
              Não encontrou o que procura?
            </h2>
            <p className="text-white/60 text-sm sm:text-base mb-8 max-w-lg mx-auto leading-relaxed">
              Fale com nossa equipe e deixe que encontramos o imóvel ideal para você.
            </p>
            <Link
              href="/contato"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:shadow-xl"
              style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
            >
              <Phone className="w-4 h-4" />
              Falar com um corretor
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
