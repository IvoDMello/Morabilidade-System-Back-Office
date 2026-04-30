import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DestaquesScroll } from "@/components/home/DestaquesScroll";
import { TestimonialCarousel } from "@/components/home/TestimonialCarousel";
import { HeroSearch } from "@/components/home/HeroSearch";
import { getImoveisDestaques, getImoveisDisponiveis } from "@/lib/api";

const diferenciais = [
  {
    icon: "◈",
    titulo: "Amplo portfólio",
    texto: "Imóveis selecionados para venda e locação nas melhores regiões da Zona Sul.",
  },
  {
    icon: "◎",
    titulo: "Atendimento personalizado",
    texto: "Nossa equipe está pronta para entender suas necessidades e encontrar o imóvel certo.",
  },
  {
    icon: "◇",
    titulo: "Processo ágil",
    texto: "Da visita à assinatura, cuidamos de toda a burocracia para você.",
  },
];

const depoimentos = [
  {
    nome: "Juliana Paiva",
    texto: "Além de ser extremamente comprometido e ter bons imóveis, ele demonstra uma preocupação genuína em ver as pessoas felizes. Pode ter certeza de que será bem assessorado.",
  },
  {
    nome: "Fabiano Sanches",
    texto: "O apartamento foi anunciado, visitado e vendido em 1 dia! Tudo com muita transparência e com uma assessoria jurídica impecável.",
  },
  {
    nome: "Fernanda Cozac",
    texto: "Com muita paciência, perseverança, transparência e parceria na condução da negociação conseguimos adquirir a casa dos sonhos. Recomendo para todos.",
  },
];

export default async function HomePage() {
  const destaquesAdmin = await getImoveisDestaques().catch(() => []);
  const { data: maisRecentes, total } = await getImoveisDisponiveis({
    page_size: "6",
  }).catch(() => ({ data: [], total: 0 }));
  const destaques = destaquesAdmin.length > 0 ? destaquesAdmin : maisRecentes;
  const usandoDestaquesAdmin = destaquesAdmin.length > 0;
  const anosDeMarket = new Date().getFullYear() - 2010;

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden flex items-center justify-center"
        style={{ minHeight: "clamp(480px, 70vh, 700px)" }}
      >
        <Image
          src="/hero-rio-inicio.jpg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(45,47,40,0.62) 0%, rgba(30,32,25,0.78) 100%)",
          }}
        />

        <div
          className="relative z-10 text-center w-full"
          style={{ padding: "0 clamp(20px,5vw,48px)", maxWidth: 780, margin: "0 auto" }}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full mb-6"
            style={{
              background: "rgba(216,203,106,0.15)",
              border: "1px solid rgba(216,203,106,0.35)",
              padding: "5px 14px",
            }}
          >
            <div
              className="rounded-full"
              style={{ width: 5, height: 5, backgroundColor: "#d8cb6a" }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#d8cb6a",
              }}
            >
              Imobiliária de confiança
            </span>
          </div>

          <h1
            className="font-serif text-white mb-5"
            style={{ fontSize: "clamp(32px,5.5vw,62px)", fontWeight: 500, lineHeight: 1.1 }}
          >
            Encontre o imóvel
            <br />
            <em style={{ color: "#e8dea0" }}>ideal para você</em>
          </h1>

          <p
            className="mb-8 mx-auto"
            style={{
              fontSize: "clamp(14px,1.8vw,17px)",
              color: "rgba(252,252,252,0.65)",
              lineHeight: 1.7,
              maxWidth: 500,
            }}
          >
            Casas, apartamentos e muito mais para venda e locação nas melhores regiões.
          </p>

          <HeroSearch />

          {total > 0 && (
            <p
              className="mt-4"
              style={{ fontSize: 12, color: "rgba(252,252,252,0.38)", letterSpacing: "0.03em" }}
            >
              {total} imóve{total !== 1 ? "is" : "l"} disponíve{total !== 1 ? "is" : "l"} agora
            </p>
          )}
        </div>
      </section>

      {/* ── Destaques ── */}
      <section style={{ backgroundColor: "#fcfcfc", padding: "clamp(48px,6vw,72px) 0" }}>
        <div style={{ maxWidth: 1176, margin: "0 auto", padding: "0 clamp(20px,5vw,48px)" }}>
          <div
            className="flex items-end justify-between flex-wrap gap-4 mb-8"
          >
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#d8cb6a",
                  marginBottom: 10,
                }}
              >
                {usandoDestaquesAdmin ? "Selecionados a dedo" : "Portfólio"}
              </p>
              <h2
                className="font-serif"
                style={{
                  fontSize: "clamp(26px,3.5vw,38px)",
                  fontWeight: 500,
                  color: "#2d2f28",
                }}
              >
                {usandoDestaquesAdmin ? "Nossos destaques" : "Imóveis disponíveis"}
              </h2>
              {total > 0 && (
                <p style={{ fontSize: 14, color: "#7a7c72", marginTop: 6 }}>
                  {total} imóve{total !== 1 ? "is" : "l"} disponíve{total !== 1 ? "is" : "l"} no portfólio
                </p>
              )}
            </div>
            <Link
              href="/imoveis"
              className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ color: "#585a4f", textDecoration: "none" }}
            >
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {destaques.length > 0 ? (
            <DestaquesScroll imoveis={destaques} />
          ) : (
            <div
              className="text-center py-16 rounded-xl border border-dashed"
              style={{ borderColor: "#e4e1d6", color: "#7a7c72" }}
            >
              <p className="font-serif text-xl mb-2">Nenhum imóvel disponível</p>
              <p className="text-sm">Em breve novidades no portfólio.</p>
            </div>
          )}
        </div>

        {destaques.length > 0 && (
          <div className="text-center" style={{ marginTop: 40 }}>
            <Link
              href="/imoveis"
              className="inline-flex items-center gap-2 font-semibold hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: "#585a4f",
                color: "#fcfcfc",
                padding: "13px 28px",
                borderRadius: 8,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Ver todos os imóveis <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {/* ── Faixa região ── */}
      <div className="relative overflow-hidden flex items-center justify-center" style={{ height: 160 }}>
        <Image
          src="/faixa-zona-sul.jpg"
          alt="Zona Sul do Rio de Janeiro"
          fill
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{ background: "rgba(30,32,25,0.72)" }}
        />
        <div className="relative z-10 text-center">
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#d8cb6a",
              marginBottom: 10,
            }}
          >
            Nossa região
          </p>
          <p
            className="font-serif text-white"
            style={{ fontSize: "clamp(20px,3vw,32px)", fontWeight: 500 }}
          >
            Zona Sul · Rio de Janeiro, RJ
          </p>
        </div>
      </div>

      {/* ── Por que escolher ── */}
      <section style={{ backgroundColor: "#f7f6f2", padding: "clamp(56px,7vw,88px) clamp(20px,5vw,48px)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div className="text-center mb-12">
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#d8cb6a",
                marginBottom: 12,
              }}
            >
              Diferenciais
            </p>
            <h2
              className="font-serif"
              style={{ fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 500, color: "#2d2f28" }}
            >
              Por que escolher a Morabilidade?
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
            }}
          >
            {diferenciais.map(({ icon, titulo, texto }) => (
              <div
                key={titulo}
                style={{
                  backgroundColor: "#fcfcfc",
                  border: "1px solid #e4e1d6",
                  borderRadius: 14,
                  padding: "28px 24px",
                }}
              >
                <div style={{ fontSize: 22, color: "#d8cb6a", marginBottom: 16, lineHeight: 1 }}>
                  {icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#2d2f28", marginBottom: 8 }}>
                  {titulo}
                </div>
                <div style={{ fontSize: 14, color: "#7a7c72", lineHeight: 1.7 }}>{texto}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      <section style={{ backgroundColor: "#fcfcfc", padding: "clamp(56px,7vw,88px) clamp(20px,5vw,48px)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#d8cb6a",
              marginBottom: 12,
            }}
          >
            Depoimentos
          </p>
          <h2
            className="font-serif"
            style={{
              fontSize: "clamp(24px,3.5vw,36px)",
              fontWeight: 500,
              color: "#2d2f28",
              marginBottom: 8,
            }}
          >
            O que nossos clientes dizem
          </h2>
          <p style={{ fontSize: 14, color: "#7a7c72", marginBottom: 48 }}>
            Histórias reais de quem encontrou o imóvel certo com a Morabilidade.
          </p>
          <TestimonialCarousel depoimentos={depoimentos} />
        </div>
      </section>

      {/* ── História ── */}
      <section style={{ backgroundColor: "#f7f6f2", padding: "clamp(56px,7vw,88px) clamp(20px,5vw,48px)" }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "clamp(220px,38%,380px) 1fr",
            gap: "clamp(32px,6vw,80px)",
            alignItems: "start",
          }}
        >
          {/* Esquerda */}
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#d8cb6a",
                marginBottom: 14,
              }}
            >
              Quem somos
            </p>
            <h2
              className="font-serif"
              style={{
                fontSize: "clamp(24px,3vw,34px)",
                fontWeight: 500,
                color: "#2d2f28",
                lineHeight: 1.2,
                marginBottom: 28,
              }}
            >
              A história por trás da Morabilidade
            </h2>
            <div
              style={{
                backgroundColor: "#585a4f",
                borderRadius: 12,
                padding: "24px 26px",
                marginBottom: 28,
              }}
            >
              <div
                className="font-serif"
                style={{ fontSize: 36, fontWeight: 600, color: "#d8cb6a" }}
              >
                +{anosDeMarket}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(252,252,252,0.75)", marginTop: 6 }}>
                Anos de Mercado
              </div>
              <div style={{ fontSize: 12, color: "rgba(252,252,252,0.4)", marginTop: 3 }}>
                Zona Sul · Rio de Janeiro
              </div>
            </div>
            <Link
              href="/sobre"
              className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity"
              style={{
                color: "#585a4f",
                textDecoration: "none",
                borderBottom: "1px solid #d8cb6a",
                paddingBottom: 2,
              }}
            >
              Conhecer mais sobre nós <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Direita */}
          <div style={{ paddingTop: 4 }}>
            <p style={{ fontSize: 15, color: "#7a7c72", lineHeight: 1.9, marginBottom: 20 }}>
              Rodrigo é carioca, quase da gema. Nasceu em Teresópolis mas viveu até os 21 anos
              no Rio, quando se mudou para o outro lado do mundo. Foram cinco anos em Pequim,
              até 2010, onde o amor pela arquitetura nasceu.
            </p>
            <p style={{ fontSize: 15, color: "#7a7c72", lineHeight: 1.9, marginBottom: 28 }}>
              Ao todo, nove mudanças em nove anos, em quatro cidades e três países. E foram
              essas experiências que fizeram com que escolhesse ser corretor de imóveis.
            </p>
            <blockquote
              style={{
                backgroundColor: "#585a4f",
                borderRadius: 12,
                padding: "22px 24px",
                borderLeft: "4px solid #d8cb6a",
              }}
            >
              <p
                className="font-serif"
                style={{
                  fontSize: 16,
                  fontStyle: "italic",
                  color: "rgba(252,252,252,0.88)",
                  lineHeight: 1.7,
                  marginBottom: 10,
                }}
              >
                &ldquo;Esse apartamento tem morabilidade, uma palavra que não existe, mas a
                gente sabe o que significa.&rdquo;
              </p>
              <div style={{ fontSize: 12, color: "rgba(252,252,252,0.42)" }}>
                Cliente, durante uma visita no fim do dia
              </div>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section
        style={{
          backgroundColor: "#3e4037",
          padding: "clamp(56px,8vw,96px) clamp(20px,5vw,48px)",
        }}
      >
        <div className="text-center" style={{ maxWidth: 600, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#d8cb6a",
              marginBottom: 16,
            }}
          >
            Fale conosco
          </p>
          <h2
            className="font-serif text-white"
            style={{
              fontSize: "clamp(26px,4vw,46px)",
              fontWeight: 500,
              marginBottom: 14,
              lineHeight: 1.15,
            }}
          >
            Não encontrou o que procura?
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "rgba(252,252,252,0.5)",
              maxWidth: 440,
              margin: "0 auto 36px",
              lineHeight: 1.75,
            }}
          >
            Fale com nossa equipe e deixe que encontremos o imóvel ideal para você.
          </p>
          <Link
            href="/contato"
            className="inline-flex items-center gap-2 font-bold hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: "#d8cb6a",
              color: "#3e4037",
              padding: "14px 30px",
              borderRadius: 8,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar com um corretor
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
