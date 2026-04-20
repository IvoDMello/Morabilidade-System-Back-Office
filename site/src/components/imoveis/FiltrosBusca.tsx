"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, Search } from "lucide-react";
import type { FiltrosParams } from "@/types";

const selectClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:border-transparent";

const inputClass = selectClass;

const VAZIOS: FiltrosParams = {
  tipo_negocio: "",
  cidade: "",
  bairro: "",
  tipo_imovel: "",
  dormitorios_min: "",
  preco_min: "",
  preco_max: "",
  condicao: "",
  mobiliado: "",
};

interface Props {
  /** Exibe os filtros como painel lateral em vez de row colapsável */
  layout?: "top" | "sidebar";
}

export function FiltrosBusca({ layout = "top" }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [aberto, setAberto] = useState(false);

  const [filtros, setFiltros] = useState<FiltrosParams>({
    tipo_negocio: params.get("tipo_negocio") ?? "",
    cidade: params.get("cidade") ?? "",
    bairro: params.get("bairro") ?? "",
    tipo_imovel: params.get("tipo_imovel") ?? "",
    dormitorios_min: params.get("dormitorios_min") ?? "",
    preco_min: params.get("preco_min") ?? "",
    preco_max: params.get("preco_max") ?? "",
    condicao: params.get("condicao") ?? "",
    mobiliado: params.get("mobiliado") ?? "",
  });

  const temFiltros = Object.values(filtros).some(Boolean);

  function aplicar(e?: React.FormEvent) {
    e?.preventDefault();
    const sp = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) sp.set(k, v); });
    sp.set("page", "1");
    router.push(`/imoveis?${sp.toString()}`);
    setAberto(false);
  }

  function limpar() {
    setFiltros(VAZIOS);
    router.push("/imoveis");
    setAberto(false);
  }

  const campos = (
    <form onSubmit={aplicar} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de negócio</label>
          <select
            value={filtros.tipo_negocio}
            onChange={(e) => setFiltros((f) => ({ ...f, tipo_negocio: e.target.value }))}
            className={selectClass}
            style={{ "--tw-ring-color": "#d8cb6a" } as React.CSSProperties}
          >
            <option value="">Todos</option>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de imóvel</label>
          <select
            value={filtros.tipo_imovel}
            onChange={(e) => setFiltros((f) => ({ ...f, tipo_imovel: e.target.value }))}
            className={selectClass}
          >
            <option value="">Todos</option>
            <option value="casa">Casa</option>
            <option value="apartamento">Apartamento</option>
            <option value="terreno">Terreno</option>
            <option value="sala">Sala comercial</option>
            <option value="galpao">Galpão</option>
            <option value="loja">Loja</option>
            <option value="cobertura">Cobertura</option>
            <option value="kitnet">Kitnet / Studio</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Dormitórios (mín.)</label>
          <select
            value={filtros.dormitorios_min}
            onChange={(e) => setFiltros((f) => ({ ...f, dormitorios_min: e.target.value }))}
            className={selectClass}
          >
            <option value="">Qualquer</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Cidade</label>
          <input
            value={filtros.cidade}
            onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
            className={inputClass}
            placeholder="Ex: São Paulo"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Bairro</label>
          <input
            value={filtros.bairro}
            onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
            className={inputClass}
            placeholder="Ex: Centro"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Condição</label>
          <select
            value={filtros.condicao}
            onChange={(e) => setFiltros((f) => ({ ...f, condicao: e.target.value }))}
            className={selectClass}
          >
            <option value="">Todas</option>
            <option value="novo">Novo</option>
            <option value="usado">Usado</option>
            <option value="em_construcao">Em construção</option>
            <option value="na_planta">Na planta</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Preço mínimo (R$)</label>
          <input
            type="number"
            min={0}
            value={filtros.preco_min}
            onChange={(e) => setFiltros((f) => ({ ...f, preco_min: e.target.value }))}
            className={inputClass}
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Preço máximo (R$)</label>
          <input
            type="number"
            min={0}
            value={filtros.preco_max}
            onChange={(e) => setFiltros((f) => ({ ...f, preco_max: e.target.value }))}
            className={inputClass}
            placeholder="Sem limite"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Mobiliado</label>
          <select
            value={filtros.mobiliado}
            onChange={(e) => setFiltros((f) => ({ ...f, mobiliado: e.target.value }))}
            className={selectClass}
          >
            <option value="">Todos</option>
            <option value="sim">Mobiliado</option>
            <option value="nao">Sem mobília</option>
            <option value="semi-mobiliado">Semi-mobiliado</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
        {temFiltros && (
          <button
            type="button"
            onClick={limpar}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition hover:opacity-90"
          style={{ backgroundColor: "#585a4f" }}
        >
          <Search className="w-4 h-4" /> Buscar
        </button>
      </div>
    </form>
  );

  if (layout === "sidebar") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-20">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" style={{ color: "#585a4f" }} />
          Filtros
        </h3>
        {campos}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium transition"
          style={{ color: "#585a4f" }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {aberto ? "Ocultar filtros" : "Mostrar filtros"}
          {temFiltros && !aberto && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#d8cb6a" }}
            />
          )}
        </button>
        {temFiltros && !aberto && (
          <button
            onClick={limpar}
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Limpar filtros
          </button>
        )}
      </div>
      {aberto && campos}
    </div>
  );
}
