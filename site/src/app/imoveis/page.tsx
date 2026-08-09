import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FiltrosBar } from "@/components/imoveis/FiltrosBar";
import { ListagemContent } from "@/components/imoveis/ListagemContent";
import { SearchTracker } from "@/components/analytics/SearchTracker";
import { getImoveisDisponiveis, getBairros } from "@/lib/api";
import type { FiltrosParams } from "@/types";

const PAGE_SIZE = 12;

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ImoveisPage({ searchParams }: Props) {
  const params = await searchParams;
  const pageRaw = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number(pageRaw ?? "1"));

  // Só bairro aceita múltiplos valores; o resto colapsa pro primeiro pra não
  // misturar tipos.
  const filtros: FiltrosParams = { page: String(page), page_size: String(PAGE_SIZE) };
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (k === "bairro") {
      (filtros as Record<string, unknown>).bairro = Array.isArray(v) ? v : [v];
    } else {
      (filtros as Record<string, unknown>)[k] = Array.isArray(v) ? v[0] : v;
    }
  }

  const [{ data: imoveis, total }, bairros] = await Promise.all([
    getImoveisDisponiveis(filtros).catch(() => ({ data: [], total: 0 })),
    getBairros(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Navbar marcaMobile />
      <SearchTracker params={params} total={total} />

      {/* Header */}
      <div
        style={{
          backgroundColor: "#585a4f",
          padding: "clamp(42px,6vw,88px) clamp(24px,5vw,64px) clamp(40px,5vw,72px)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <p
            className="flex items-center justify-center"
            style={{
              fontSize: "clamp(11px,1.2vw,12px)",
              letterSpacing: "0.28em",
              fontWeight: 700,
              color: "#d8cb6a",
              textTransform: "uppercase",
              gap: "clamp(11px,1.4vw,14px)",
            }}
          >
            <span
              aria-hidden
              className="flex-shrink-0"
              style={{ width: "clamp(20px,2.4vw,28px)", height: 1, backgroundColor: "#d8cb6a" }}
            />
            Portfólio · Curadoria
            <span
              aria-hidden
              className="flex-shrink-0"
              style={{ width: "clamp(20px,2.4vw,28px)", height: 1, backgroundColor: "#d8cb6a" }}
            />
          </p>
          <h1
            className="font-serif"
            style={{
              fontSize: "clamp(36px,5vw,62px)",
              fontWeight: 500,
              lineHeight: 1.12,
              color: "#fcfcfc",
              margin: "clamp(18px,2vw,26px) 0 clamp(14px,1.6vw,20px)",
            }}
          >
            Cada imóvel tem <em style={{ fontWeight: 400 }}>uma história</em>
          </h1>
          <p
            style={{
              fontSize: "clamp(14.5px,1.6vw,17px)",
              color: "rgba(252,252,252,0.72)",
              maxWidth: 560,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Selecionamos apenas os imóveis que nos encantam: pela arquitetura, pelo bairro, pelo
            potencial. Zona Sul, Rio de Janeiro.
          </p>
        </div>
      </div>

      {/* Filtros horizontais */}
      <Suspense>
        <FiltrosBar total={total} bairros={bairros} />
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
