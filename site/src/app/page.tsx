import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { DestaquesScroll } from "@/components/home/DestaquesScroll";
import { TestimonialCarousel } from "@/components/home/TestimonialCarousel";
import { HeroSearch } from "@/components/home/HeroSearch";
import { getImoveisDestaques, getImoveisDisponiveis } from "@/lib/api";

const pilares = [
  {
    num: "01",
    titulo: "Simples",
    texto:
      "Simplificamos a comunicação, os processos e as decisões. Escolhemos sempre o caminho da verdade e buscamos tornar tudo menos burocrático, sem abrir mão da segurança.",
  },
  {
    num: "02",
    titulo: "Eficiente",
    texto:
      "Temos um cuidado criterioso na precificação dos imóveis, sempre alinhada à realidade do mercado, e conduzimos cada etapa com organização, agilidade e atenção aos detalhes. Isso nos permitiu alcançar resultados expressivos, com diversas vendas realizadas em tempo recorde.",
  },
  {
    num: "03",
    titulo: "Humanizada",
    texto:
      "Acreditamos em relações próximas, empatia e cuidado genuíno com as pessoas em todos os momentos do processo.",
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
          src="/nova_foto_hero.jpeg"
          alt="Vista do Rio de Janeiro"
          fill
          className="object-cover object-center"
          style={{ filter: "saturate(1.22) contrast(1.04) brightness(1.02)" }}
          priority
        />
        {/* wash quente (soft-light) */}
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            background:
              "linear-gradient(155deg, rgba(216,203,106,0.05) 0%, rgba(216,203,106,0.02) 35%, rgba(46,48,42,0.04) 65%, rgba(46,48,42,0.10) 100%)",
          }}
        />
        {/* spotlight radial */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 72% 62% at 50% 52%, rgba(20,22,18,0.62) 0%, rgba(20,22,18,0.42) 40%, rgba(20,22,18,0.10) 74%, rgba(20,22,18,0) 100%)",
          }}
        />
        {/* mobile: escurecimento extra para deixar a imagem menos poluída */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,22,18,0.32) 0%, rgba(20,22,18,0.22) 50%, rgba(20,22,18,0.34) 100%)",
          }}
        />
        {/* bordas superior/inferior */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,22,18,0.20) 0%, rgba(20,22,18,0) 22%, rgba(20,22,18,0) 78%, rgba(20,22,18,0.22) 100%)",
          }}
        />

        <div
          className="relative z-10 text-center w-full"
          style={{ padding: "0 clamp(20px,5vw,48px)", maxWidth: 780, margin: "0 auto" }}
        >
          {/* Logo grande (mobile only) */}
          <div className="md:hidden flex justify-center mb-6">
            <Image
              src="/Logo_fundoTransparente.png"
              alt="Morabilidade"
              width={440}
              height={128}
              style={{
                height: "clamp(96px, 28vw, 160px)",
                width: "auto",
                objectFit: "contain",
                filter:
                  "drop-shadow(0 2px 8px rgba(0,0,0,0.55)) drop-shadow(0 0 24px rgba(0,0,0,0.4))",
              }}
              priority
            />
          </div>

          <h1
            className="font-serif text-white mb-5"
            style={{
              fontSize: "clamp(32px,5.5vw,62px)",
              fontWeight: 500,
              lineHeight: 1.1,
              textShadow: "0 2px 28px rgba(20,22,18,0.55)",
            }}
          >
            Encontre o imóvel
            <br />
            <em style={{ color: "#e8dea0" }}>ideal para você</em>
          </h1>

          <HeroSearch />
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

      {/* ── Faixa região (azulejo Morabilidade) ── */}
      <section className="relative overflow-hidden flex items-center justify-center bg-olive-800 min-h-[240px]">
        {/* base: padrão de azulejo tilado */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/assets/azulejo-morabilidade.png)",
            backgroundSize: "auto 384px",
            backgroundRepeat: "repeat-x",
            backgroundPosition: "center center",
            filter: "saturate(1.20) contrast(1.04) brightness(1.02)",
          }}
        />
        {/* wash quente (soft-light) */}
        <div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            background:
              "linear-gradient(155deg, rgba(216,203,106,0.05) 0%, rgba(216,203,106,0.02) 35%, rgba(46,48,42,0.04) 65%, rgba(46,48,42,0.10) 100%)",
          }}
        />
        {/* vignette lateral olive */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(46,48,42,0.78) 0%, rgba(46,48,42,0.38) 16%, rgba(46,48,42,0.28) 50%, rgba(46,48,42,0.38) 84%, rgba(46,48,42,0.78) 100%)",
          }}
        />
        {/* scrim central para legibilidade */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 38% 75% at 50% 50%, rgba(20,22,18,0.62) 0%, rgba(20,22,18,0) 100%)",
          }}
        />
        {/* hairlines dourados */}
        <div
          className="absolute top-0 inset-x-0 h-px opacity-40"
          style={{ background: "linear-gradient(90deg, transparent, #d8cb6a 50%, transparent)" }}
        />
        <div
          className="absolute bottom-0 inset-x-0 h-px opacity-40"
          style={{ background: "linear-gradient(90deg, transparent, #d8cb6a 50%, transparent)" }}
        />

        <div className="relative z-10 text-center px-5 py-7">
          <div
            className="text-[10px] font-bold tracking-[0.22em] uppercase text-gold-400 mb-2.5"
            style={{ textShadow: "0 1px 8px rgba(20,22,18,0.7)" }}
          >
            Nossa região
          </div>
          <div
            className="font-display font-medium text-white"
            style={{
              fontSize: "clamp(20px,3vw,32px)",
              textShadow: "0 2px 16px rgba(20,22,18,0.7)",
            }}
          >
            Zona Sul · Rio de Janeiro, RJ
          </div>
        </div>
      </section>

      {/* ── Proprietário + Por que a Morabilidade (merged) ── */}
      <section
        style={{ backgroundColor: "#f7f6f2", position: "relative", overflow: "hidden" }}
      >
        {/* Echo strip dourada no topo */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background:
              "linear-gradient(90deg, #585a4f, #d8cb6a 50%, #585a4f)",
            opacity: 0.4,
          }}
        />

        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "clamp(56px,7vw,96px) clamp(20px,5vw,48px)",
          }}
        >
          <div
            className="proprietario-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
              gap: "clamp(32px,5vw,72px)",
              alignItems: "stretch",
            }}
          >
            {/* LEFT — coluna da foto */}
            <div
              className="proprietario-photo"
              style={{
                position: "relative",
                minHeight: "clamp(420px, 60vh, 640px)",
              }}
            >
              {/* moldura dourada com offset */}
              <div
                className="proprietario-photo-frame"
                style={{
                  position: "absolute",
                  inset: 0,
                  border: "1.5px solid #d8cb6a",
                  borderRadius: 14,
                  transform: "translate(14px, 14px)",
                  opacity: 0.55,
                }}
              />
              {/* foto */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#e8e5db",
                  boxShadow: "0 20px 50px rgba(88,90,79,0.22)",
                }}
              >
                <Image
                  src="/assets/rodrigo-proprietario.jpeg"
                  alt="Rodrigo Barbosa — sócio-fundador da Morabilidade"
                  fill
                  sizes="(max-width: 860px) 100vw, 45vw"
                  style={{ objectFit: "cover", objectPosition: "center 30%" }}
                />
                {/* gradiente inferior para legibilidade */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: "45%",
                    background:
                      "linear-gradient(180deg, rgba(46,48,42,0) 0%, rgba(46,48,42,0.78) 100%)",
                  }}
                />
                {/* legenda sobre a foto */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: "clamp(20px,3vw,32px)",
                    color: "#fcfcfc",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "#e8dea0",
                      marginBottom: 8,
                    }}
                  >
                    Sócio-fundador
                  </div>
                  <div
                    className="font-serif"
                    style={{
                      fontSize: "clamp(22px,2.6vw,30px)",
                      fontWeight: 500,
                      lineHeight: 1.15,
                      marginBottom: 6,
                    }}
                  >
                    Rodrigo Barbosa
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(252,252,252,0.7)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Corretor · CRECI-RJ nº 70411
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — coluna de conteúdo */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingTop: 6,
              }}
            >
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
                Por que a Morabilidade
              </p>
              <h2
                className="font-serif"
                style={{
                  fontSize: "clamp(26px,3.6vw,42px)",
                  fontWeight: 500,
                  color: "#2d2f28",
                  lineHeight: 1.15,
                  marginBottom: 22,
                }}
              >
                Uma imobiliária com
                <br />
                <em style={{ color: "#585a4f" }}>nome, rosto e história.</em>
              </h2>
              <p
                style={{
                  fontSize: "clamp(14px,1.4vw,16px)",
                  color: "#7a7c72",
                  lineHeight: 1.85,
                  marginBottom: 14,
                  maxWidth: 560,
                }}
              >
                Por trás da Morabilidade está{" "}
                <strong style={{ color: "#2d2f28", fontWeight: 600 }}>
                  Rodrigo Barbosa
                </strong>
                . Carioca, com mais de 15 anos de mercado imobiliário e a Zona Sul
                como território de atuação.
              </p>
              <p
                style={{
                  fontSize: "clamp(14px,1.4vw,16px)",
                  color: "#7a7c72",
                  lineHeight: 1.85,
                  marginBottom: 36,
                  maxWidth: 560,
                }}
              >
                Atendimento pessoal, do primeiro contato até a entrega das chaves.
                Sem call center, sem terceirização, sem ruído.
              </p>

              {/* Pilares — Simples · Eficiente · Humanizada */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  borderTop: "1px solid #e4e1d6",
                }}
              >
                {pilares.map(({ num, titulo, texto }) => (
                  <div
                    key={num}
                    className="pilar-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px 1fr",
                      gap: "clamp(14px,2vw,28px)",
                      padding: "22px 0",
                      borderBottom: "1px solid #e4e1d6",
                      alignItems: "baseline",
                    }}
                  >
                    <div
                      className="font-serif"
                      style={{
                        fontSize: "clamp(20px,2vw,24px)",
                        fontStyle: "italic",
                        color: "#d8cb6a",
                        fontWeight: 500,
                        lineHeight: 1,
                      }}
                    >
                      {num}
                    </div>
                    <div>
                      <div
                        className="font-serif"
                        style={{
                          fontSize: "clamp(20px,2vw,24px)",
                          fontWeight: 500,
                          color: "#2d2f28",
                          marginBottom: 8,
                          letterSpacing: "-0.01em",
                          lineHeight: 1.1,
                        }}
                      >
                        {titulo}
                      </div>
                      <div
                        style={{
                          fontSize: "clamp(13.5px,1.3vw,15px)",
                          color: "#7a7c72",
                          lineHeight: 1.7,
                        }}
                      >
                        {texto}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div
                style={{
                  marginTop: 32,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP ?? "5500000000000"}?text=${encodeURIComponent("Olá! Gostaria de mais informações sobre os imóveis disponíveis na Morabilidade.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95 active:shadow-inner"
                  style={{
                    gap: 9,
                    background: "#585a4f",
                    color: "#fcfcfc",
                    textDecoration: "none",
                    padding: "12px 22px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Entre em contato
                </a>
                <Link
                  href="/sobre"
                  className="inline-flex items-center hover:opacity-80 transition-opacity"
                  style={{
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#585a4f",
                    textDecoration: "none",
                    borderBottom: "1px solid #d8cb6a",
                    paddingBottom: 2,
                  }}
                >
                  Conhecer a história completa
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
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
          className="grid grid-cols-1 md:grid-cols-[clamp(220px,38%,380px)_1fr]"
          style={{
            maxWidth: 1080,
            margin: "0 auto",
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
