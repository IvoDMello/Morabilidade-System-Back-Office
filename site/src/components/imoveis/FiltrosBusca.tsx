"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, Search, ChevronDown, Plus } from "lucide-react";

const inputCls =
  "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 " +
  "focus:outline-none focus:ring-2 focus:ring-olive-600/20 focus:border-olive-600/40 transition placeholder:text-slate-300";

interface FiltrosState {
  tipo_negocio: string;
  cidade: string;
  bairros: string[]; // multi
  tipo_imovel: string;
  dormitorios_min: string;
  andar_max: string;
  preco_min: string;
  preco_max: string;
  condicao: string;
  mobiliado: string;
  codigo: string;
}

const VAZIOS: FiltrosState = {
  tipo_negocio: "",
  cidade: "",
  bairros: [],
  tipo_imovel: "",
  dormitorios_min: "",
  andar_max: "",
  preco_min: "",
  preco_max: "",
  condicao: "",
  mobiliado: "",
  codigo: "",
};

function normalizar(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface Props {
  layout?: "top" | "sidebar";
  bairros?: string[];
}

export function FiltrosBusca({ layout = "top", bairros = [] }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [aberto, setAberto] = useState(false);

  const [filtros, setFiltros] = useState<FiltrosState>({
    tipo_negocio: params.get("tipo_negocio") ?? "",
    cidade: params.get("cidade") ?? "",
    bairros: params.getAll("bairro"),
    tipo_imovel: params.get("tipo_imovel") ?? "",
    dormitorios_min: params.get("dormitorios_min") ?? "",
    andar_max: params.get("andar_max") ?? "",
    preco_min: params.get("preco_min") ?? "",
    preco_max: params.get("preco_max") ?? "",
    condicao: params.get("condicao") ?? "",
    mobiliado: params.get("mobiliado") ?? "",
    codigo: params.get("codigo") ?? "",
  });

  const temFiltros = useMemo(() => {
    return Object.entries(filtros).some(([k, v]) => {
      if (k === "bairros") return (v as string[]).length > 0;
      return Boolean(v);
    });
  }, [filtros]);
  const qtdFiltros = useMemo(() => {
    return Object.entries(filtros).filter(([k, v]) => {
      if (k === "bairros") return (v as string[]).length > 0;
      return Boolean(v);
    }).length;
  }, [filtros]);

  function aplicar(e?: React.FormEvent) {
    e?.preventDefault();
    const sp = new URLSearchParams();
    // q da barra principal vira inválido quando o usuário aplica filtros estruturados.
    Object.entries(filtros).forEach(([k, v]) => {
      if (k === "bairros") {
        (v as string[]).forEach((b) => sp.append("bairro", b));
      } else if (v) {
        sp.set(k, v as string);
      }
    });
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

  // ── Autocomplete de bairros ──────────────────────────────────────────────────
  const [bairroInput, setBairroInput] = useState("");
  const [bairroOpen, setBairroOpen] = useState(false);
  const bairroWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (bairroWrapRef.current && !bairroWrapRef.current.contains(e.target as Node)) {
        setBairroOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const bairrosSugeridos = useMemo(() => {
    const t = normalizar(bairroInput.trim());
    return bairros
      .filter((b) => !filtros.bairros.includes(b))
      .filter((b) => !t || normalizar(b).includes(t))
      .slice(0, 8);
  }, [bairroInput, bairros, filtros.bairros]);

  function addBairro(b: string) {
    if (!b || filtros.bairros.includes(b)) return;
    setFiltros((f) => ({ ...f, bairros: [...f.bairros, b] }));
    setBairroInput("");
  }
  function removeBairro(b: string) {
    setFiltros((f) => ({ ...f, bairros: f.bairros.filter((x) => x !== b) }));
  }

  const campos = (
    <form onSubmit={aplicar} className="space-y-4">
      <div>
        <label className={labelCls}>Código do imóvel</label>
        <input
          value={filtros.codigo}
          onChange={(e) => setFiltros((f) => ({ ...f, codigo: e.target.value }))}
          className={inputCls}
          placeholder="Ex.: MB-00013"
        />
      </div>

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
          <option value="casa_vila">Casa de vila</option>
          <option value="casa_condominio">Casa de condomínio</option>
          <option value="apartamento">Apartamento</option>
          <option value="galpao">Galpão</option>
          <option value="cobertura">Cobertura</option>
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

      <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
        <input
          type="checkbox"
          checked={filtros.andar_max === "1"}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, andar_max: e.target.checked ? "1" : "" }))
          }
          className="w-4 h-4 rounded accent-[#585a4f]"
        />
        Apenas térreo <span className="text-slate-400">(1º andar)</span>
      </label>

      <div>
        <label className={labelCls}>Cidade</label>
        <input
          value={filtros.cidade}
          onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
          className={inputCls}
          placeholder="Qualquer"
        />
      </div>

      {/* Bairros, multi-select com chips */}
      <div ref={bairroWrapRef}>
        <label className={labelCls}>Bairros</label>
        {filtros.bairros.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {filtros.bairros.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#585a4f", color: "#fcfcfc" }}
              >
                {b}
                <button
                  type="button"
                  onClick={() => removeBairro(b)}
                  aria-label={`Remover ${b}`}
                  className="rounded-full p-0.5 hover:bg-white/10"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            value={bairroInput}
            onChange={(e) => {
              setBairroInput(e.target.value);
              setBairroOpen(true);
            }}
            onFocus={() => setBairroOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const exato = bairros.find(
                  (b) => normalizar(b) === normalizar(bairroInput.trim()),
                );
                if (exato) addBairro(exato);
                else if (bairrosSugeridos.length > 0) addBairro(bairrosSugeridos[0]);
              }
            }}
            className={inputCls}
            placeholder={filtros.bairros.length === 0 ? "Adicionar bairro…" : "+ outro bairro"}
          />
          {bairroOpen && bairrosSugeridos.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
              {bairrosSugeridos.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    addBairro(b);
                    setBairroOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span>{b}</span>
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          )}
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
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-[104px]">
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
          <div className="pt-5">{campos}</div>
        </div>
      )}
    </div>
  );
}
