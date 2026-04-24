"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { ImovelCard } from "@/components/imoveis/ImovelCard";
import type { ImovelCard as ImovelCardType } from "@/types";

interface Props {
  imoveis: ImovelCardType[];
  total: number;
  page: number;
  totalPages: number;
}

export function ListagemContent({ imoveis, total, page, totalPages }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function irParaPagina(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(p));
    router.push(`/imoveis?${sp.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function paginas(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
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
      <p className="text-slate-400 text-sm mb-6 h-5">
        {total === 0
          ? "Nenhum imóvel encontrado para os filtros selecionados."
          : `${total} imóve${total !== 1 ? "is" : "l"} encontrado${total !== 1 ? "s" : ""}`}
      </p>

      {imoveis.length === 0 ? (
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

      {totalPages > 1 && (
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
              <span key={`ellipsis-${i}`} className="px-1 text-slate-300 text-sm select-none">···</span>
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
