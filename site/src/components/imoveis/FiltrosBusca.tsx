"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, Search, ChevronDown } from "lucide-react";
import type { FiltrosParams } from "@/types";

const inputCls =
  "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-olive-600/20 focus:border-olive-600/40 transition placeholder:text-slate-300";

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
  const qtdFiltros = Object.values(filtros).filter(Boolean).length;

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

  const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

  const campos = (
    <form onSubmit={aplicar} className="space-y-4">
      <div>
        <label className={labelCls}>Negócio</label>
        <select
          value={filtros.tipo_negocio}
          onChange={(e) => setFiltros((f) => ({ ...f, tipo_negocio: e.target.value }))}
          className={inputCls}
        >
          <option value="">Venda ou locação</option>
          <option value="venda">Venda</option>
          <option value="locacao">Locação</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Tipo de imóvel</label>
        <select
          value={filtros.tipo_imovel}
          onChange={(e) => setFiltros((f) => ({ ...f, tipo_imovel: e.target.value }))}
          className={inputCls}
        >
          <option value="">Todos os tipos</option>
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
        <label className={labelCls}>Dormitórios</label>
        <select
          value={filtros.dormitorios_min}
          onChange={(e) => setFiltros((f) => ({ ...f, dormitorios_min: e.target.value }))}
          className={inputCls}
        >
          <option value="">Qualquer quantidade</option>
          <option value="1">1 ou mais</option>
          <option value="2">2 ou mais</option>
          <option value="3">3 ou mais</option>
          <option value="4">4 ou mais</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Cidade</label>
          <input
            value={filtros.cidade}
            onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
            className={inputCls}
            placeholder="Qualquer"
          />
        </div>
        <div>
          <label className={labelCls}>Bairro</label>
          <input
            value={filtros.bairro}
            onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
            className={inputCls}
            placeholder="Qualquer"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Condição</label>
        <select
          value={filtros.condicao}
          onChange={(e) => setFiltros((f) => ({ ...f, condicao: e.target.value }))}
          className={inputCls}
        >
          <option value="">Todas</option>
          <option value="novo">Novo</option>
          <option value="usado">Usado</option>
          <option value="em_construcao">Em construção</option>
          <option value="na_planta">Na planta</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Faixa de preço (R$)</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            min={0}
            value={filtros.preco_min}
            onChange={(e) => setFiltros((f) => ({ ...f, preco_min: e.target.value }))}
            className={inputCls}
            placeholder="Mínimo"
          />
          <input
            type="number"
            min={0}
            value={filtros.preco_max}
            onChange={(e) => setFiltros((f) => ({ ...f, preco_max: e.target.value }))}
            className={inputCls}
            placeholder="Máximo"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Mobiliado</label>
        <select
          value={filtros.mobiliado}
          onChange={(e) => setFiltros((f) => ({ ...f, mobiliado: e.target.value }))}
          className={inputCls}
        >
          <option value="">Todos</option>
          <option value="sim">Mobiliado</option>
          <option value="nao">Sem mobília</option>
          <option value="semi-mobiliado">Semi-mobiliado</option>
        </select>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        {temFiltros && (
          <button
            type="button"
            onClick={limpar}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition hover:opacity-90"
          style={{ backgroundColor: "#585a4f" }}
        >
          <Search className="w-4 h-4" />
          Aplicar filtros
        </button>
      </div>
    </form>
  );

  if (layout === "sidebar") {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-20">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <SlidersHorizontal className="w-4 h-4" style={{ color: "#585a4f" }} />
            Filtros
          </h3>
          {temFiltros && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: "#585a4f" }}
            >
              {qtdFiltros}
            </span>
          )}
        </div>
        {campos}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium transition hover:bg-slate-50 rounded-2xl"
        style={{ color: "#585a4f" }}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" />
          Filtros de busca
          {temFiltros && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: "#585a4f" }}
            >
              {qtdFiltros}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <div className="pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Negócio</label>
                <select
                  value={filtros.tipo_negocio}
                  onChange={(e) => setFiltros((f) => ({ ...f, tipo_negocio: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Todos</option>
                  <option value="venda">Venda</option>
                  <option value="locacao">Locação</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select
                  value={filtros.tipo_imovel}
                  onChange={(e) => setFiltros((f) => ({ ...f, tipo_imovel: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Todos</option>
                  <option value="casa">Casa</option>
                  <option value="apartamento">Apartamento</option>
                  <option value="terreno">Terreno</option>
                  <option value="sala">Sala comercial</option>
                  <option value="cobertura">Cobertura</option>
                  <option value="kitnet">Kitnet</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Dormitórios</label>
                <select
                  value={filtros.dormitorios_min}
                  onChange={(e) => setFiltros((f) => ({ ...f, dormitorios_min: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Qualquer</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Cidade</label>
                <input
                  value={filtros.cidade}
                  onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
                  className={inputCls}
                  placeholder="Qualquer"
                />
              </div>
              <div>
                <label className={labelCls}>Bairro</label>
                <input
                  value={filtros.bairro}
                  onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
                  className={inputCls}
                  placeholder="Qualquer"
                />
              </div>
              <div>
                <label className={labelCls}>Preço mín. (R$)</label>
                <input
                  type="number"
                  min={0}
                  value={filtros.preco_min}
                  onChange={(e) => setFiltros((f) => ({ ...f, preco_min: e.target.value }))}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Preço máx. (R$)</label>
                <input
                  type="number"
                  min={0}
                  value={filtros.preco_max}
                  onChange={(e) => setFiltros((f) => ({ ...f, preco_max: e.target.value }))}
                  className={inputCls}
                  placeholder="Sem limite"
                />
              </div>
              <div>
                <label className={labelCls}>Mobiliado</label>
                <select
                  value={filtros.mobiliado}
                  onChange={(e) => setFiltros((f) => ({ ...f, mobiliado: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Todos</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                  <option value="semi-mobiliado">Semi</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
              {temFiltros && (
                <button
                  type="button"
                  onClick={limpar}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition"
                >
                  <X className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => aplicar()}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition hover:opacity-90"
                style={{ backgroundColor: "#585a4f" }}
              >
                <Search className="w-4 h-4" /> Buscar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
