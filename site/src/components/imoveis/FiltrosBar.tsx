"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ChevronDown } from "lucide-react";

const TIPOS_IMOVEL = [
  { value: "", label: "Todos os tipos" },
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "cobertura", label: "Cobertura" },
  { value: "kitnet", label: "Kitnet" },
  { value: "terreno", label: "Terreno" },
  { value: "sala", label: "Sala comercial" },
  { value: "loja", label: "Loja" },
];

const ORDENAR_OPTIONS = [
  { value: "", label: "Mais recentes" },
  { value: "mais_antigo", label: "Mais antigos" },
  { value: "preco_asc", label: "Menor preço" },
  { value: "preco_desc", label: "Maior preço" },
];

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: "7px 16px",
  borderRadius: 100,
  fontSize: 13,
  fontFamily: "inherit",
  fontWeight: active ? 600 : 400,
  backgroundColor: active ? "#585a4f" : "#fcfcfc",
  color: active ? "#fcfcfc" : "#585a4f",
  border: `1.5px solid ${active ? "#585a4f" : "#e4e1d6"}`,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
});

const selectStyle: React.CSSProperties = {
  appearance: "none",
  backgroundColor: "#fcfcfc",
  border: "1.5px solid #e4e1d6",
  borderRadius: 100,
  padding: "7px 34px 7px 16px",
  fontSize: 13,
  fontFamily: "inherit",
  color: "#585a4f",
  cursor: "pointer",
  outline: "none",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

interface Props {
  total: number;
  bairros?: string[];
}

export function FiltrosBar({ total, bairros = [] }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const [tipoNeg, setTipoNeg] = useState(params.get("tipo_negocio") ?? "todos");
  const [tipoImovel, setTipoImovel] = useState(params.get("tipo_imovel") ?? "");
  const [bairro, setBairro] = useState(params.get("bairro") ?? "");
  const [ordenar, setOrdenar] = useState(params.get("ordenar") ?? "");

  function buildUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v && v !== "todos") sp.set(k, v);
      else sp.delete(k);
    }
    sp.set("page", "1");
    return `/imoveis?${sp.toString()}`;
  }

  function handleNeg(v: string) {
    setTipoNeg(v);
    router.push(buildUrl({ tipo_negocio: v }));
  }

  function handleTipo(v: string) {
    setTipoImovel(v);
    router.push(buildUrl({ tipo_imovel: v }));
  }

  function handleOrdenar(v: string) {
    setOrdenar(v);
    router.push(buildUrl({ ordenar: v }));
  }

  function handleBairroSubmit() {
    router.push(buildUrl({ bairro }));
  }

  const negPills = [
    { v: "todos", l: "Tudo" },
    { v: "venda", l: "Venda" },
    { v: "locacao", l: "Locação" },
  ];

  const datalistId = "bairros-datalist";

  return (
    <div
      className="bg-[#fcfcfc] md:sticky z-[40] md:z-[90]"
      style={{ top: 60, borderBottom: "1px solid #e4e1d6" }}
    >
      <div
        className="flex items-center gap-2 overflow-x-auto"
        style={{
          height: 60,
          padding: "0 clamp(20px, 5vw, 48px)",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          maxWidth: 1176,
          margin: "0 auto",
        }}
      >
        <style>{`::-webkit-scrollbar{display:none}`}</style>

        {/* Label */}
        <span
          className="flex items-center gap-1.5 flex-shrink-0 text-sm"
          style={{ color: "#7a7c72" }}
        >
          <SlidersHorizontal className="w-[15px] h-[15px]" />
          <span className="hidden sm:inline">Filtros</span>
        </span>

        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: "#e4e1d6" }} />

        {/* Tipo negócio — pills */}
        {negPills.map(({ v, l }) => (
          <button
            key={v}
            onClick={() => handleNeg(v)}
            className="flex-shrink-0 transition-all duration-150"
            style={pillStyle(tipoNeg === v)}
          >
            {l}
          </button>
        ))}

        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: "#e4e1d6" }} />

        {/* Tipo imóvel */}
        <div className="relative flex-shrink-0">
          <select
            value={tipoImovel}
            onChange={(e) => handleTipo(e.target.value)}
            style={selectStyle}
          >
            {TIPOS_IMOVEL.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5"
            style={{ color: "#6e7063" }}
          />
        </div>

        {/* Bairro com autocomplete */}
        <div className="relative flex-shrink-0">
          <input
            type="text"
            list={datalistId}
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBairroSubmit();
            }}
            onBlur={handleBairroSubmit}
            placeholder="Bairro"
            aria-label="Filtrar por bairro"
            style={{
              ...selectStyle,
              padding: "7px 16px",
              width: "auto",
              minWidth: 110,
              maxWidth: 160,
            }}
          />
          {bairros.length > 0 && (
            <datalist id={datalistId}>
              {bairros.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          )}
        </div>

        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: "#e4e1d6" }} />

        {/* Ordenar */}
        <div className="relative flex-shrink-0">
          <select
            value={ordenar}
            onChange={(e) => handleOrdenar(e.target.value)}
            style={selectStyle}
            aria-label="Ordenar resultados"
          >
            {ORDENAR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5"
            style={{ color: "#6e7063" }}
          />
        </div>

        {/* Contador */}
        <div
          className="ml-auto flex-shrink-0 text-xs italic"
          style={{ color: "#7a7c72", whiteSpace: "nowrap" }}
        >
          {total} {total === 1 ? "imóvel" : "imóveis"}
        </div>
      </div>
    </div>
  );
}
