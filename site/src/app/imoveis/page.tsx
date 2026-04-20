"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
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

  return (
    <div className="flex-1">
      {/* Resumo */}
      <p className="text-slate-500 text-sm mb-6">
        {loading
          ? "Buscando imóveis..."
          : total === 0
          ? "Nenhum imóvel encontrado para os filtros selecionados."
          : `${total} imóvel${total !== 1 ? "is" : ""} encontrado${total !== 1 ? "s" : ""}`}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-slate-100 animate-pulse aspect-[4/5]"
            />
          ))}
        </div>
      ) : imoveis.length === 0 ? (
        <div className="py-20 text-center text-slate-300">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-slate-400">Nenhum imóvel encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {imoveis.map((imovel) => (
            <ImovelCard key={imovel.id} imovel={imovel} />
          ))}
        </div>
      )}

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => irParaPagina(page - 1)}
            disabled={page === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => irParaPagina(p)}
                className={`w-9 h-9 text-sm rounded-lg border transition ${
                  p === page
                    ? "text-white border-transparent"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
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
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition"
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          Imóveis disponíveis
        </h1>
        <p className="text-slate-500 mb-8">
          Encontre o imóvel ideal com os nossos filtros de busca.
        </p>

        {/* Filtros */}
        <Suspense>
          <FiltrosBusca layout="top" />
        </Suspense>

        {/* Listagem */}
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-slate-100 animate-pulse aspect-[4/5]" />
              ))}
            </div>
          }
        >
          <ListagemContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
