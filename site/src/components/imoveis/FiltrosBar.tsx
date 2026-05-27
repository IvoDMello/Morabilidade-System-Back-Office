"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ChevronDown, X, Hash } from "lucide-react";

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

export function FiltrosBar({ total: _total, bairros = [] }: Props) {
  void _total;
  const router = useRouter();
  const params = useSearchParams();

  const [tipoNeg, setTipoNeg] = useState(params.get("tipo_negocio") ?? "todos");
  const tipoImovelUrl = params.get("tipo_imovel") ?? "";
  const apenasTerreo = params.get("andar_max") === "1";
  const tipoImovelInicial =
    tipoImovelUrl === "apartamento" && apenasTerreo ? "apartamento_terreo" : tipoImovelUrl;
  const [tipoImovel, setTipoImovel] = useState(tipoImovelInicial);
  const [ordenar, setOrdenar] = useState(params.get("ordenar") ?? "");
  const [codigoInput, setCodigoInput] = useState(params.get("codigo") ?? "");

  const bairrosAtuais = params.getAll("bairro");
  const codigoAtual = params.get("codigo") ?? "";

  function buildUrl(overrides: Record<string, string | string[] | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(overrides)) {
      sp.delete(k);
      if (v === null || v === "") continue;
      if (Array.isArray(v)) {
        v.forEach((item) => sp.append(k, item));
      } else if (v !== "todos") {
        sp.set(k, v);
      }
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

  function adicionarBairro(b: string) {
    if (!b || bairrosAtuais.includes(b)) return;
    router.push(buildUrl({ bairro: [...bairrosAtuais, b] }));
  }

  function removerBairro(b: string) {
    router.push(buildUrl({ bairro: bairrosAtuais.filter((x) => x !== b) }));
  }

  function aplicarCodigo() {
    const v = codigoInput.trim().toUpperCase();
    router.push(buildUrl({ codigo: v || null }));
  }

  function limparCodigo() {
    setCodigoInput("");
    router.push(buildUrl({ codigo: null }));
  }

  const hasFilters =
    (tipoNeg && tipoNeg !== "todos") ||
    !!tipoImovel ||
    bairrosAtuais.length > 0 ||
    !!codigoAtual ||
    !!ordenar;

  function handleLimpar() {
    setTipoNeg("todos");
    setTipoImovel("");
    setCodigoInput("");
    setOrdenar("");
    router.push("/imoveis?page=1");
  }

  const negPills = [
    { v: "todos", l: "Tudo" },
    { v: "venda", l: "Venda" },
    { v: "locacao", l: "Locação" },
  ];

  // Só mostra no select os bairros que ainda não estão nos chips.
  const bairrosDisponiveis = bairros.filter((b) => !bairrosAtuais.includes(b));

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

        <span
          className="flex items-center gap-1.5 flex-shrink-0 text-sm"
          style={{ color: "#7a7c72" }}
        >
          <SlidersHorizontal className="w-[15px] h-[15px]" />
          <span className="hidden sm:inline">Filtros</span>
        </span>

        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: "#e4e1d6" }} />

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

        {/* Bairro — select multi (ao selecionar, vira chip) */}
        {bairros.length > 0 && (
          <div className="relative flex-shrink-0">
            <select
              value=""
              onChange={(e) => {
                adicionarBairro(e.target.value);
                e.target.value = "";
              }}
              style={selectStyle}
              aria-label="Adicionar bairro"
              disabled={bairrosDisponiveis.length === 0}
            >
              <option value="" disabled>
                {bairrosAtuais.length === 0
                  ? "Todos os bairros"
                  : bairrosDisponiveis.length === 0
                    ? "Todos selecionados"
                    : "+ adicionar bairro"}
              </option>
              {bairrosDisponiveis.map((b) => (
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
        )}

        {/* Chips dos bairros selecionados */}
        {bairrosAtuais.map((b) => (
          <span
            key={b}
            className="flex items-center gap-1 flex-shrink-0"
            style={{
              padding: "5px 6px 5px 12px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 500,
              backgroundColor: "#585a4f",
              color: "#fcfcfc",
              whiteSpace: "nowrap",
            }}
          >
            {b}
            <button
              type="button"
              onClick={() => removerBairro(b)}
              aria-label={`Remover ${b}`}
              className="rounded-full p-0.5 hover:bg-white/15 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Código — input separado */}
        <div className="relative flex-shrink-0">
          <Hash
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "#6e7063" }}
          />
          <input
            type="text"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value)}
            onBlur={() => {
              if (codigoInput.trim().toUpperCase() !== codigoAtual) aplicarCodigo();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicarCodigo();
              }
            }}
            placeholder="Código"
            aria-label="Buscar por código"
            style={{
              backgroundColor: "#fcfcfc",
              border: "1.5px solid #e4e1d6",
              borderRadius: 100,
              padding: "7px 28px 7px 30px",
              fontSize: 13,
              fontFamily: "inherit",
              color: "#585a4f",
              outline: "none",
              width: 140,
              textTransform: "uppercase",
            }}
          />
          {codigoInput && (
            <button
              type="button"
              onClick={limparCodigo}
              aria-label="Limpar código"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[#e4e1d6]/50"
            >
              <X className="w-3 h-3" style={{ color: "#6e7063" }} />
            </button>
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
