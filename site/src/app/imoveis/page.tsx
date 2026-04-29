import { Suspense } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FiltrosBusca } from "@/components/imoveis/FiltrosBusca";
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

      <div
        className="border-b border-white/10"
        style={{ background: "linear-gradient(135deg, #2e302a 0%, #585a4f 100%)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#d8cb6a" }}>
            Portfólio
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">
            Imóveis disponíveis
          </h1>
          <p className="text-white/50 mt-2 text-sm">
            Encontre o imóvel ideal com os nossos filtros de busca.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex gap-8">
          {/* Sidebar — desktop */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <Suspense>
              <FiltrosBusca layout="sidebar" />
            </Suspense>
          </aside>

          {/* Conteúdo principal */}
          <div className="flex-1 min-w-0">
            {/* Filtros top — mobile/tablet */}
            <div className="lg:hidden mb-6">
              <Suspense>
                <FiltrosBusca layout="top" />
              </Suspense>
            </div>

            <Suspense
              fallback={
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-slate-100 animate-pulse aspect-[3/4]" />
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
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
