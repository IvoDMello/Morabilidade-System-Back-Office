"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Building2, SlidersHorizontal } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ImovelCard } from "@/components/imoveis/ImovelCard";
import { FiltrosBusca } from "@/components/imoveis/FiltrosBusca";
import { getImoveisDisponiveis } from "@/lib/api";
import type { ImovelCard as ImovelCardType } from "@/types";

const PAGE_SIZE = 12;

function ListagemContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [imoveis, setImoveis] = useState<ImovelCardType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page") ?? "1");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(searchParams.entries());
    params.page_size = String(PAGE_SIZE);

    getImoveisDisponiveis(params)
      .then(({ data, total }) => {
        setImoveis(data);
        setTotal(total);
      })
      .catch(() => {
        setImoveis([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  function irParaPagina(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    router.push(`/imoveis?${sp.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Gera array de páginas com ellipsis */
  function paginas(): (number | "...")[] {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++)
      pages.push(p);
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div>
      {/* Resumo */}
      <p className="text-slate-400 text-sm mb-6 h-5">
        {loading
          ? "Buscando imóveis..."
          : total === 0
          ? "Nenhum imóvel encontrado para os filtros selecionados."
          : `${total} imóve${total !== 1 ? "is" : "l"} encontrado${total !== 1 ? "s" : ""}`}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-100 animate-pulse aspect-[16/11]" />
          ))}
        </div>
      ) : imoveis.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-slate-200 rounded-2xl">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 text-sm">Nenhum imóvel encontrado.</p>
          <button
            onClick={() => router.push("/imoveis")}
            className="mt-4 text-xs font-medium underline underline-offset-2"
            style={{ color: "#585a4f" }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {imoveis.map((imovel) => (
            <ImovelCard key={imovel.id} imovel={imovel} />
          ))}
        </div>
      )}

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-12">
          <button
            onClick={() => irParaPagina(page - 1)}
            disabled={page === 1}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {paginas().map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-slate-300 text-sm select-none">
                ···
              </span>
            ) : (
              <button
                key={p}
                onClick={() => irParaPagina(p as number)}
                className={`w-9 h-9 text-sm rounded-xl border transition-colors font-medium ${
                  p === page
                    ? "border-transparent text-white"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                }`}
                style={p === page ? { backgroundColor: "#585a4f" } : undefined}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => irParaPagina(page + 1)}
            disabled={page === totalPages}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ImoveisPage() {
  return (
    <>
      <Navbar />

      {/* Hero band */}
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
                    <div key={i} className="rounded-2xl bg-slate-100 animate-pulse aspect-[16/11]" />
                  ))}
                </div>
              }
            >
              <ListagemContent />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
