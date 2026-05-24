"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";

const TIPOS_IMOVEL = [
  { value: "", label: "Todos os tipos" },
  { value: "apartamento", label: "Apartamento" },
  { value: "apartamento_terreo", label: "Apartamento térreo" },
  { value: "casa", label: "Casa" },
  { value: "casa_vila", label: "Casa de vila" },
  { value: "casa_condominio", label: "Casa de condomínio" },
  { value: "cobertura", label: "Cobertura" },
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
  const tipoImovelUrl = params.get("tipo_imovel") ?? "";
  const apenasTerreo = params.get("andar_max") === "1";
  const tipoImovelInicial =
    tipoImovelUrl === "apartamento" && apenasTerreo ? "apartamento_terreo" : tipoImovelUrl;
  const [tipoImovel, setTipoImovel] = useState(tipoImovelInicial);
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
    if (v === "apartamento_terreo") {
      router.push(buildUrl({ tipo_imovel: "apartamento", andar_max: "1" }));
    } else {
      router.push(buildUrl({ tipo_imovel: v, andar_max: "" }));
    }
  }

  function handleOrdenar(v: string) {
    setOrdenar(v);
    router.push(buildUrl({ ordenar: v }));
  }

  function handleBairro(v: string) {
    setBairro(v);
    router.push(buildUrl({ bairro: v }));
  }

  const hasFilters =
    (tipoNeg && tipoNeg !== "todos") ||
    !!tipoImovel ||
    !!bairro ||
    !!ordenar;

  function handleLimpar() {
    setTipoNeg("todos");
    setTipoImovel("");
    setBairro("");
    setOrdenar("");
    router.push("/imoveis?page=1");
  }

  const negPills = [
    { v: "todos", l: "Tudo" },
    { v: "venda", l: "Venda" },
    { v: "locacao", l: "Locação" },
  ];

  return (
    <div
      className="bg-[#fcfcfc] md:sticky z-[40] md:z-[90]"
      style={{ top: "clamp(96px, 12vw, 104px)", borderBottom: "1px solid #e4e1d6" }}
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

        {/* Bairro — select com bairros que têm imóveis disponíveis */}
        {bairros.length > 0 && (
          <>
            <div className="relative flex-shrink-0">
              <select
                value={bairro}
                onChange={(e) => handleBairro(e.target.value)}
                style={selectStyle}
                aria-label="Filtrar por bairro"
              >
                <option value="">Todos os bairros</option>
                {bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5"
                style={{ color: "#6e7063" }}
              />
            </div>
            <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: "#e4e1d6" }} />
          </>
        )}

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

        {/* Limpar filtros — só aparece quando há filtros aplicados */}
        {hasFilters && (
          <button
            onClick={handleLimpar}
            className="ml-auto flex items-center gap-1 flex-shrink-0 transition-colors"
            style={{
              padding: "7px 14px",
              borderRadius: 100,
              fontSize: 13,
              fontFamily: "inherit",
              backgroundColor: "transparent",
              color: "#585a4f",
              border: "1.5px solid #e4e1d6",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            aria-label="Limpar filtros"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </button>
        )}

      </div>
    </div>
  );
}
