import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FiltrosBar } from "@/components/imoveis/FiltrosBar";
import { ListagemContent } from "@/components/imoveis/ListagemContent";
import { getImoveisDisponiveis } from "@/lib/api";

const PAGE_SIZE = 12;

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ImoveisPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));

  const { data: imoveis, total } = await getImoveisDisponiveis({
    ...params,
    page: String(page),
    page_size: String(PAGE_SIZE),
  }).catch(() => ({ data: [], total: 0 }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Navbar />

      {/* Header */}
      <div
        style={{
          backgroundColor: "#585a4f",
          padding: "clamp(36px,5vw,56px) clamp(20px,5vw,48px) clamp(40px,5vw,52px)",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              fontWeight: 600,
              color: "#d8cb6a",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Portfólio · Curadoria
          </p>
          <h1
            className="font-serif text-white"
            style={{
              fontSize: "clamp(32px,5vw,50px)",
              fontWeight: 500,
              lineHeight: 1.1,
              marginBottom: 14,
            }}
          >
            Cada imóvel tem
            <br />
            <em>uma história</em>
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "rgba(252,252,252,0.6)",
              maxWidth: 440,
              lineHeight: 1.75,
            }}
          >
            Selecionamos apenas os imóveis que nos encantam: pela arquitetura, pelo bairro, pelo
            potencial. Zona Sul, Rio de Janeiro.
          </p>
        </div>
      </div>

      {/* Filtros horizontais */}
      <Suspense>
        <FiltrosBar total={total} />
      </Suspense>

      {/* Grid */}
      <main
        style={{
          maxWidth: 1176,
          margin: "0 auto",
          padding: "clamp(28px,4vw,44px) clamp(20px,5vw,48px) 100px",
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                gap: "clamp(16px,3vw,28px)",
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[14px] bg-[#e4e1d6] animate-pulse"
                  style={{ aspectRatio: "3/4" }}
                />
              ))}
            </div>
          }
        >
          <ListagemContent
            imoveis={imoveis}
            total={total}
            page={page}
            totalPages={totalPages}
          />
        </Suspense>
      </main>

      <Footer />
    </>
  );
}
