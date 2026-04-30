import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ChannelCards } from "@/components/contato/ChannelCards";

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
    : "https://wa.link/we06jw";

  const stats = [
    { n: "+ de 10", d: "anos de mercado" },
    { n: "100%", d: "atendimento online" },
    { n: "Zona Sul", d: "Rio de Janeiro · RJ" },
  ];

  return (
    <>
      <Navbar />

      {/* ── Hero ── */}
      <div style={{ backgroundColor: "#585a4f" }}>
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "clamp(48px,6vw,72px) clamp(20px,5vw,48px)",
          }}
        >
          {/* Tag badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full mb-6"
            style={{
              background: "rgba(216,203,106,0.12)",
              border: "1px solid rgba(216,203,106,0.3)",
              padding: "5px 14px",
            }}
          >
            <div
              className="rounded-full"
              style={{ width: 6, height: 6, backgroundColor: "#d8cb6a" }}
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
              Atendimento
            </span>
          </div>

          {/* Grid: slogan + stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "clamp(240px,55%,560px) 1fr",
              gap: "clamp(24px,5vw,64px)",
              alignItems: "center",
            }}
          >
            {/* Esquerda */}
            <div>
              <h1
                className="font-serif text-white"
                style={{
                  fontSize: "clamp(30px,4.5vw,52px)",
                  fontWeight: 500,
                  lineHeight: 1.1,
                  marginBottom: 20,
                }}
              >
                Simples.
                <br />
                Eficiente.
                <br />
                <em style={{ color: "#e8dea0" }}>Humanizada.</em>
              </h1>
              <p
                style={{
                  fontSize: "clamp(14px,1.5vw,16px)",
                  color: "rgba(252,252,252,0.62)",
                  lineHeight: 1.8,
                  maxWidth: 400,
                  marginBottom: 24,
                }}
              >
                Atendimento direto e sem burocracia, do primeiro contato até a entrega das
                chaves.
              </p>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    backgroundColor: "rgba(252,252,252,0.07)",
                    border: "1px solid rgba(252,252,252,0.12)",
                    color: "rgba(252,252,252,0.45)",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    padding: "3px 10px",
                    borderRadius: 100,
                    textTransform: "uppercase",
                  }}
                >
                  100% Digital
                </span>
              </div>
            </div>

            {/* Direita — stats (hidden mobile) */}
            <div
              className="hidden md:grid"
              style={{ gridTemplateRows: "1fr 1fr 1fr", gap: 10 }}
            >
              {stats.map(({ n, d }) => (
                <div
                  key={n}
                  style={{
                    backgroundColor: "rgba(252,252,252,0.06)",
                    border: "1px solid rgba(252,252,252,0.09)",
                    borderRadius: 10,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    className="font-serif"
                    style={{
                      fontSize: "clamp(18px,2vw,24px)",
                      fontWeight: 600,
                      color: "#d8cb6a",
                      flexShrink: 0,
                    }}
                  >
                    {n}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(252,252,252,0.5)", lineHeight: 1.4 }}>
                    {d}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Canais ── */}
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "clamp(40px,5vw,60px) clamp(20px,5vw,48px) 80px",
        }}
      >
        {imovel && (
          <div
            className="rounded-xl p-4 text-sm mb-6"
            style={{
              backgroundColor: "rgba(216,203,106,0.1)",
              border: "1px solid rgba(216,203,106,0.3)",
              color: "#585a4f",
            }}
          >
            Você quer falar sobre o imóvel{" "}
            <strong className="font-mono">{imovel}</strong>. Já incluímos isso na mensagem
            do WhatsApp.
          </div>
        )}

        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#7a7c72",
            marginBottom: 20,
          }}
        >
          Fale com a gente
        </p>

        <ChannelCards hrefWhatsapp={hrefWhatsapp} hrefInstagram={INSTAGRAM} />

        {/* Rodapé da seção */}
        <div
          style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 14 }}
        >
          <div style={{ flex: 1, height: 1, backgroundColor: "#e4e1d6" }} />
          <p
            style={{
              fontSize: 13,
              color: "#b5b8ac",
              fontStyle: "italic",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            Imobiliária 100% digital · sem sede física
          </p>
          <div style={{ flex: 1, height: 1, backgroundColor: "#e4e1d6" }} />
        </div>
      </div>

      <Footer />
    </>
  );
}
