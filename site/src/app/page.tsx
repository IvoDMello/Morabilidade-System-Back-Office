import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  Phone,
  Briefcase,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ImovelCard } from "@/components/imoveis/ImovelCard";
import { HeroSearch } from "@/components/home/HeroSearch";
import { getImoveisDisponiveis } from "@/lib/api";

export default async function HomePage() {
  const anosDeMarket = new Date().getFullYear() - 2010;
  const { data: destaques, total } = await getImoveisDisponiveis({
    page_size: "6",
  }).catch(() => ({ data: [], total: 0 }));

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background photo */}
        <Image
          src="/fundo3-3.jpeg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Olive gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(46,48,42,0.90) 0%, rgba(88,90,79,0.85) 55%, rgba(74,77,67,0.92) 100%)" }}
        />
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

          {/* Quick search */}
          <HeroSearch />

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

      {/* ── Foto da região ── */}
      <div className="relative h-44 sm:h-56 overflow-hidden">
        <Image
          src="/fundo2-3.jpeg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(46,48,42,0.52)" }}
        >
          <div className="text-center px-4">
            <p className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-2">
              Nossa região
            </p>
            <p className="font-serif text-2xl sm:text-3xl font-bold text-white">
              Zona Sul · Rio de Janeiro, RJ
            </p>
          </div>
        </div>
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

      {/* ── Depoimentos ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#d8cb6a" }}>
            Depoimentos
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-olive-900">
            O que nossos clientes dizem
          </h2>
          <p className="text-slate-500 text-sm mt-3 max-w-md mx-auto">
            Histórias reais de quem encontrou o imóvel certo com a Morabilidade.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              nome: "Mariana Costa",
              cidade: "Ipanema, RJ",
              inicial: "M",
              texto: "Encontrei meu apartamento em menos de duas semanas. Atendimento incrível, super ágil e personalizado. Superou todas as expectativas!",
            },
            {
              nome: "Rafael Mendonça",
              cidade: "Botafogo, RJ",
              inicial: "R",
              texto: "Procurava um imóvel para investimento e a equipe trouxe opções certeiras. Todo o processo pelo WhatsApp, extremamente prático.",
            },
            {
              nome: "Juliana e Pedro Alves",
              cidade: "Leblon, RJ",
              inicial: "J",
              texto: "Compramos nosso primeiro apartamento pela Morabilidade. Foram transparentes em cada etapa e fechamos com total segurança.",
            },
            {
              nome: "Camila Rodrigues",
              cidade: "Copacabana, RJ",
              inicial: "C",
              texto: "Aluguel resolvido em dias! Me apresentaram imóveis dentro do meu perfil e a negociação foi tranquila. Recomendo muito.",
            },
          ].map((dep) => (
            <div
              key={dep.nome}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 flex flex-col gap-4 hover:shadow-card-hover transition-shadow"
            >
              {/* Estrelas */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill="#d8cb6a" aria-hidden="true">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              {/* Texto */}
              <p className="text-slate-600 text-sm leading-relaxed flex-1">
                &ldquo;{dep.texto}&rdquo;
              </p>
              {/* Autor */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-50">
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

      {/* ── A história por trás da Morabilidade ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Coluna esquerda — stats + tagline */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#d8cb6a" }}>
                Quem somos
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-olive-900 leading-tight">
                A história por trás da Morabilidade
              </h2>
            </div>

            {/* Anos de mercado */}
            <div
              className="rounded-2xl p-6 flex items-center gap-5"
              style={{ backgroundColor: "#585a4f" }}
            >
              <div className="flex-shrink-0">
                <p className="text-5xl font-bold leading-none" style={{ color: "#d8cb6a" }}>
                  {anosDeMarket}
                </p>
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">Anos de<br />Mercado</p>
                <p className="text-white/50 text-xs mt-1">Zona Sul · Rio de Janeiro</p>
              </div>
            </div>

            {/* Estatísticas secundárias */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { num: "9", label: "Mudanças em 9 anos" },
                { num: "4", label: "Cidades" },
                { num: "3", label: "Países" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl p-4 text-center border border-slate-100 bg-white shadow-sm"
                >
                  <p className="text-2xl font-bold" style={{ color: "#585a4f" }}>{stat.num}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            <Link
              href="/sobre"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:opacity-80"
              style={{ color: "#585a4f" }}
            >
              Conheça mais sobre nós
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Coluna direita — história */}
          <div className="lg:col-span-8 space-y-6">
            <p className="text-slate-600 text-sm leading-relaxed">
              Rodrigo é carioca, quase da gema. Nasceu em Teresópolis mas viveu até os 21 anos no Rio,
              quando se mudou para o outro lado do mundo. Passou cinco anos em Pequim, China,
              até 2008, ano dos Jogos Olímpicos — e foi lá que o amor pela arquitetura nasceu.
              Pequim é repleta de obras de grandes arquitetos de peso mundial que despertaram um olhar
              para a arquitetura em quem, até então, só tinha formação na área da saúde.
            </p>

            <p className="text-slate-600 text-sm leading-relaxed">
              Depois foram dois anos em Washington, DC. E mais dois anos em São Paulo.
              Até voltar ao Rio. Ao todo, nove mudanças em nove anos, em quatro cidades, três países.
              E foram essas mudanças, e o trabalho envolvido em todas elas, que fizeram com que
              Rodrigo escolhesse ser corretor de imóveis.
            </p>

            {/* Citação de destaque */}
            <blockquote
              className="rounded-2xl p-6 border-l-4 my-2"
              style={{ backgroundColor: "#f5f5f3", borderLeftColor: "#d8cb6a" }}
            >
              <p className="text-slate-700 text-sm leading-relaxed italic">
                &ldquo;Esse apartamento tem <strong>morabilidade</strong> — uma palavra que não existe,
                mas a gente sabe o que significa.&rdquo;
              </p>
              <p className="text-slate-400 text-xs mt-3">— Cliente, durante uma visita no fim do dia</p>
            </blockquote>

            <p className="text-slate-600 text-sm leading-relaxed">
              Em 2012, de volta ao Rio, nasceu então a Morabilidade. E depois de mais de uma década
              em operação, a empresa se atualiza, se moderniza, cresce. O que nasceu como a
              &ldquo;empresa de um homem só&rdquo; hoje tem uma equipe, setor jurídico próprio,
              administração de imóveis e explora as mídias sociais que mais trazem resultados
              nas vendas e locações.
            </p>

            <p className="text-slate-600 text-sm leading-relaxed">
              Mas não deixa de lado o compromisso de conhecer bem todos os imóveis que comercializa
              ou administra. E mais do que isso, conhecer suas histórias. É a paixão do trabalho:
              a história que todo imóvel conta e a ciência da importância que é a busca por um novo lar.
            </p>
          </div>
        </div>
      </section>

      {/* ── Divisor decorativo ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <hr className="border-slate-200" />
      </div>

      {/* ── CTA Contato ── */}
      <section className="mx-4 sm:mx-6 lg:mx-8 mb-20 rounded-3xl overflow-hidden relative">
        {/* Background photo */}
        <Image
          src="/fundo3-3.jpeg"
          alt=""
          fill
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(46,48,42,0.92) 0%, rgba(88,90,79,0.88) 100%)" }}
        />
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
