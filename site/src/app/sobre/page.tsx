import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
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
    texto:
      "Sem sede física, sem burocracia desnecessária. Todo o processo, da busca ao fechamento, acontece de forma ágil e online.",
  },
  {
    titulo: "Atendimento personalizado",
    texto:
      "Cada cliente recebe atenção individual. Entendemos seu perfil, seus objetivos e apresentamos apenas os imóveis que fazem sentido para você.",
  },
  {
    titulo: "Agilidade via WhatsApp",
    texto:
      "Dúvidas, propostas e agendamentos resolvidos em minutos. Nossa equipe responde no mesmo dia, sem filas nem espera.",
  },
  {
    titulo: "Curadoria de imóveis",
    texto:
      "Selecionamos e verificamos cada imóvel antes de publicar. Você vê apenas opções reais, com informações completas e fotos atualizadas.",
  },
  {
    titulo: "Transparência total",
    texto:
      "Valores, condições e documentação apresentados com clareza desde o primeiro contato. Sem surpresas no processo.",
  },
  {
    titulo: "Comunidade engajada",
    texto:
      "Com mais de 80 mil seguidores no Instagram, somos referência em conteúdo imobiliário e alcançamos compradores e locatários ativos.",
  },
];

const passos = [
  {
    n: "01",
    titulo: "Entre em contato",
    texto:
      "Fale conosco pelo WhatsApp ou nos envie uma mensagem pelo Instagram. A conversa começa de forma simples e sem compromisso.",
  },
  {
    n: "02",
    titulo: "Entendemos seu perfil",
    texto:
      "Conversamos sobre o que você busca: localização, tipo de imóvel, faixa de preço e suas prioridades. Sem questionários longos.",
  },
  {
    n: "03",
    titulo: "Selecionamos as melhores opções",
    texto:
      "Com base no seu perfil, apresentamos imóveis que realmente fazem sentido para você, sem perda de tempo com opções fora do seu interesse.",
  },
  {
    n: "04",
    titulo: "Agendamos a visita",
    texto:
      "Organizamos tudo para a visita ao imóvel no horário mais conveniente para você, acompanhado pela nossa equipe.",
  },
  {
    n: "05",
    titulo: "Negociação e fechamento",
    texto:
      "Assessoramos a proposta, negociação e toda a documentação até a entrega das chaves. Com transparência do início ao fim.",
  },
];

const depoimentos = [
  {
    nome: "Marcelo Guidini",
    inicial: "M",
    texto:
      "Rodrigo foi atencioso em todas as etapas da compra do imóvel, desde a primeira visita até a assinatura da escritura. Esclareceu minhas dúvidas sempre com agilidade e transparência, o que me deixou muito seguro de estar fazendo um bom negócio.",
  },
  {
    nome: "Juliana Paiva",
    inicial: "J",
    texto:
      "Comprar, vender ou investir em um imóvel é sempre delicado. Ter um corretor como o Rodrigo é um porto seguro. Além de ser extremamente comprometido e ter bons imóveis, ele demonstra uma preocupação genuína em ver as pessoas felizes. Pode ter certeza de que será bem assessorado.",
  },
  {
    nome: "Fabiano Sanches",
    inicial: "F",
    texto:
      "Eu não sabia que uma imobiliária poderia fazer mais do que simplesmente multiplicar o preço médio do m² pela área do imóvel. Encontrei na Morabilidade outra abordagem. O resultado? O apartamento foi anunciado, visitado e vendido em 1 dia!",
  },
  {
    nome: "Fernanda Cozac",
    inicial: "F",
    texto:
      "Rodrigo, desde o início, entendeu qual era o estilo de imóvel que estávamos procurando e fez um filtro muito assertivo. Com muita paciência, perseverança, transparência e parceria na condução da negociação, conseguimos adquirir a casa dos sonhos.",
  },
];

const stats = [
  { n: "+10", d: "Anos de mercado" },
  { n: "+80k", d: "Seguidores no Instagram" },
  { n: "100%", d: "Atendimento digital" },
  { n: "ZS", d: "Zona Sul · Rio de Janeiro" },
];

export default function SobrePage() {
  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <div
        style={{
          backgroundColor: "#585a4f",
          padding: "clamp(48px,6vw,72px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
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
            Sobre nós
          </p>
          <h1
            className="font-serif text-white"
            style={{
              fontSize: "clamp(28px,5vw,52px)",
              fontWeight: 500,
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            Imobiliária feita para
            <br />o mundo digital
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "rgba(252,252,252,0.62)",
              lineHeight: 1.8,
              maxWidth: 520,
              margin: "0 auto 28px",
            }}
          >
            A Morabilidade nasceu digital e cresceu conectando pessoas ao imóvel certo, com
            agilidade, transparência e atendimento humanizado.
          </p>
          <div
            className="inline-flex items-center gap-2 rounded-full"
            style={{
              background: "rgba(252,252,252,0.08)",
              border: "1px solid rgba(252,252,252,0.14)",
              padding: "8px 16px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(252,252,252,0.7)">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            <span style={{ fontSize: 13, color: "rgba(252,252,252,0.7)", fontWeight: 500 }}>
              @morabilidade
            </span>
            <div
              style={{ width: 1, height: 14, backgroundColor: "rgba(252,252,252,0.2)" }}
            />
            <span style={{ fontSize: 13, color: "#d8cb6a", fontWeight: 600 }}>
              +80k seguidores
            </span>
          </div>
        </div>
      </div>

      {/* ── Nossa história ── */}
      <div
        style={{
          backgroundColor: "#fcfcfc",
          padding: "clamp(56px,7vw,80px) clamp(20px,5vw,48px)",
        }}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-[1fr_clamp(200px,30%,300px)]"
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            gap: "clamp(32px,6vw,64px)",
            alignItems: "start",
          }}
        >
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
              Nossa história
            </p>
            <p style={{ fontSize: 15, color: "#7a7c72", lineHeight: 1.9, marginBottom: 18 }}>
              A Morabilidade surgiu com uma proposta diferente: oferecer uma experiência
              imobiliária completamente digital, sem burocracia e sem a necessidade de uma sede
              física. Desde o início, apostamos nas redes sociais e no WhatsApp como nossos
              principais canais de atendimento.
            </p>
            <p style={{ fontSize: 15, color: "#7a7c72", lineHeight: 1.9, marginBottom: 18 }}>
              O que começou como uma nova forma de conectar compradores e locatários a imóveis
              de qualidade tem hoje uma comunidade ativa de mais de 80 mil pessoas no Instagram,
              que acompanham lançamentos, dicas de mercado e oportunidades exclusivas.
            </p>
            <p style={{ fontSize: 15, color: "#7a7c72", lineHeight: 1.9 }}>
              Hoje, ajudamos centenas de famílias e investidores a encontrar o imóvel ideal,
              com agilidade, curadoria cuidadosa e um atendimento que respeita o seu tempo.
            </p>
          </div>
          <div
            style={{
              background: "linear-gradient(145deg, #3e4037 0%, #585a4f 100%)",
              border: "1px solid rgba(216,203,106,0.22)",
              borderRadius: 14,
              padding: "44px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 18,
              boxShadow: "0 8px 32px rgba(45,47,40,0.14)",
            }}
          >
            <Image
              src="/Logo_fundoTransparente.png"
              alt="Morabilidade"
              width={260}
              height={78}
              style={{ width: "95%", height: "auto", objectFit: "contain" }}
            />
            <div style={{ width: 36, height: 1, backgroundColor: "rgba(216,203,106,0.45)" }} />
            <p style={{ fontSize: 12, color: "rgba(216,203,106,0.75)", fontStyle: "italic", letterSpacing: "0.07em" }}>
              Imobiliária 100% digital
            </p>
          </div>
        </div>
      </div>

      {/* ── Números ── */}
      <div
        style={{
          backgroundColor: "#585a4f",
          padding: "clamp(48px,6vw,64px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center", marginBottom: 40 }}>
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
            Morabilidade em números
          </p>
          <p style={{ fontSize: 14, color: "rgba(252,252,252,0.55)" }}>
            Mais de uma década atuando na Zona Sul do Rio com transparência e dedicação
          </p>
        </div>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 20,
          }}
        >
          {stats.map(({ n, d }) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                padding: "24px 16px",
                borderRadius: 12,
                backgroundColor: "rgba(252,252,252,0.06)",
                border: "1px solid rgba(252,252,252,0.1)",
              }}
            >
              <div
                className="font-serif"
                style={{ fontSize: 36, fontWeight: 600, color: "#d8cb6a", marginBottom: 8 }}
              >
                {n}
              </div>
              <div style={{ fontSize: 13, color: "rgba(252,252,252,0.55)", lineHeight: 1.5 }}>
                {d}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Por que escolher ── */}
      <div
        style={{
          backgroundColor: "#f7f6f2",
          padding: "clamp(56px,7vw,80px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2
              className="font-serif"
              style={{
                fontSize: "clamp(24px,3.5vw,36px)",
                fontWeight: 500,
                color: "#2d2f28",
                marginBottom: 10,
              }}
            >
              Por que escolher a Morabilidade?
            </h2>
            <p style={{ fontSize: 14, color: "#7a7c72" }}>
              Combinamos tecnologia, atendimento humano e profundo conhecimento do mercado.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 16,
            }}
          >
            {diferenciais.map(({ titulo, texto }) => (
              <div
                key={titulo}
                style={{
                  backgroundColor: "#fcfcfc",
                  border: "1px solid #e4e1d6",
                  borderRadius: 12,
                  padding: "24px 22px",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#d8cb6a",
                    marginBottom: 14,
                  }}
                />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2d2f28", marginBottom: 8 }}>
                  {titulo}
                </div>
                <div style={{ fontSize: 13, color: "#7a7c72", lineHeight: 1.7 }}>{texto}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Como funciona ── */}
      <div
        style={{
          backgroundColor: "#fcfcfc",
          padding: "clamp(56px,7vw,80px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2
              className="font-serif"
              style={{
                fontSize: "clamp(24px,3.5vw,36px)",
                fontWeight: 500,
                color: "#2d2f28",
                marginBottom: 10,
              }}
            >
              Como funciona o atendimento
            </h2>
            <p style={{ fontSize: 14, color: "#7a7c72" }}>
              Um processo simples, transparente e pensado para respeitar o seu tempo.
            </p>
          </div>
          <div>
            {passos.map((p, i) => (
              <div
                key={p.n}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  paddingBottom: i < passos.length - 1 ? 32 : 0,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: "#585a4f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{ fontSize: 11, fontWeight: 700, color: "#d8cb6a", letterSpacing: "0.05em" }}
                    >
                      {p.n}
                    </span>
                  </div>
                  {i < passos.length - 1 && (
                    <div
                      style={{
                        width: 1,
                        flex: 1,
                        backgroundColor: "#e4e1d6",
                        marginTop: 8,
                        minHeight: 24,
                      }}
                    />
                  )}
                </div>
                <div style={{ paddingTop: 8, paddingBottom: i < passos.length - 1 ? 8 : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#585a4f", marginBottom: 6 }}>
                    {p.titulo}
                  </div>
                  <div style={{ fontSize: 14, color: "#7a7c72", lineHeight: 1.7 }}>{p.texto}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Depoimentos 2×2 ── */}
      <div
        style={{
          backgroundColor: "#f7f6f2",
          padding: "clamp(56px,7vw,80px) clamp(20px,5vw,48px)",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
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
            <p style={{ fontSize: 14, color: "#7a7c72" }}>
              Histórias reais de quem encontrou o imóvel certo com a Morabilidade.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 20,
            }}
          >
            {depoimentos.map((d) => (
              <div
                key={d.nome}
                style={{
                  backgroundColor: "#fcfcfc",
                  border: "1px solid #e4e1d6",
                  borderRadius: 14,
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ color: "#d8cb6a", fontSize: 14 }}>★</span>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 14,
                    color: "#7a7c72",
                    lineHeight: 1.75,
                    fontStyle: "italic",
                    flex: 1,
                  }}
                >
                  &ldquo;{d.texto}&rdquo;
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderTop: "1px solid #e4e1d6",
                    paddingTop: 14,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      backgroundColor: "#585a4f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#d8cb6a" }}>
                      {d.inicial}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#2d2f28" }}>{d.nome}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA Final ── */}
      <div
        style={{
          backgroundColor: "#3e4037",
          padding: "clamp(56px,8vw,88px) clamp(20px,5vw,48px)",
          textAlign: "center",
        }}
      >
        <h2
          className="font-serif text-white"
          style={{
            fontSize: "clamp(24px,4vw,42px)",
            fontWeight: 500,
            marginBottom: 14,
            lineHeight: 1.15,
          }}
        >
          Pronto para encontrar seu imóvel?
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "rgba(252,252,252,0.5)",
            maxWidth: 400,
            margin: "0 auto 36px",
            lineHeight: 1.75,
          }}
        >
          Nossa equipe está à disposição para ajudar você em cada etapa, do primeiro contato à
          entrega das chaves.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/imoveis"
            className="inline-flex items-center gap-2 font-bold hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: "#d8cb6a",
              color: "#3e4037",
              padding: "13px 26px",
              borderRadius: 8,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Ver imóveis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contato"
            className="inline-flex items-center gap-2 font-semibold hover:bg-white/5 transition-colors"
            style={{
              color: "#fcfcfc",
              border: "1.5px solid rgba(252,252,252,0.3)",
              padding: "13px 26px",
              borderRadius: 8,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar com a equipe
          </Link>
        </div>
      </div>

      <Footer />
    </>
  );
}
