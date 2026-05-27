"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, ChevronDown, X, Search } from "lucide-react";

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

// Heurística: parece código se tem dígito e começa com "MB" ou é "MB-XXXXX".
function pareceCodigo(s: string): boolean {
  const t = s.trim().toUpperCase();
  return /^MB[-\s]?\d/.test(t) || /^\d{3,}$/.test(t);
}

function normalizar(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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

  // Estado da busca: bairros aplicados ficam como chips; código/q ocupam o input.
  const bairrosAtuais = params.getAll("bairro");
  const codigoAtual = params.get("codigo") ?? "";
  const qAtual = params.get("q") ?? "";
  const buscaInicial = codigoAtual || qAtual || "";
  const [busca, setBusca] = useState(buscaInicial);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fecha autocomplete quando clica fora.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAutocompleteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  function aplicarBusca(termo: string) {
    const t = termo.trim();
    if (!t) {
      router.push(buildUrl({ bairro: null, codigo: null, q: null }));
      return;
    }
    if (pareceCodigo(t)) {
      router.push(buildUrl({ bairro: null, q: null, codigo: t.toUpperCase() }));
    } else {
      // Texto livre: usa q (back-end faz OR código/bairro)
      router.push(buildUrl({ bairro: null, codigo: null, q: t }));
    }
    setAutocompleteOpen(false);
  }

  function selecionarBairro(b: string) {
    if (bairrosAtuais.includes(b)) {
      setBusca("");
      setAutocompleteOpen(false);
      return;
    }
    setBusca("");
    router.push(
      buildUrl({ codigo: null, q: null, bairro: [...bairrosAtuais, b] }),
    );
    setAutocompleteOpen(false);
  }

  function removerBairro(b: string) {
    router.push(
      buildUrl({ bairro: bairrosAtuais.filter((x) => x !== b) }),
    );
  }

  function limparBusca() {
    setBusca("");
    router.push(buildUrl({ codigo: null, q: null }));
    setAutocompleteOpen(false);
  }

  const sugestoes = useMemo(() => {
    const termoNorm = normalizar(busca.trim());
    if (!termoNorm) return [];
    return bairros
      .filter((b) => normalizar(b).includes(termoNorm))
      .slice(0, 6);
  }, [busca, bairros]);

  const hasFilters =
    (tipoNeg && tipoNeg !== "todos") ||
    !!tipoImovel ||
    bairrosAtuais.length > 0 ||
    !!codigoAtual ||
    !!qAtual ||
    !!ordenar;

  function handleLimpar() {
    setTipoNeg("todos");
    setTipoImovel("");
    setBusca("");
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
        className="flex items-center gap-2 overflow-x-auto overflow-y-visible"
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

        {/* Busca unificada: código ou bairro (multi) */}
        <div ref={wrapRef} className="relative flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
              style={{ color: "#6e7063" }}
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setAutocompleteOpen(true);
              }}
              onFocus={() => setAutocompleteOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (autocompleteOpen && sugestoes.length > 0) {
                    selecionarBairro(sugestoes[0]);
                  } else {
                    aplicarBusca(busca);
                  }
                }
                if (e.key === "Escape") setAutocompleteOpen(false);
              }}
              placeholder={
                bairrosAtuais.length > 0 ? "+ outro bairro ou código" : "Código ou bairro"
              }
              aria-label="Buscar por código ou bairro"
              style={{
                backgroundColor: "#fcfcfc",
                border: "1.5px solid #e4e1d6",
                borderRadius: 100,
                padding: "7px 30px 7px 32px",
                fontSize: 13,
                fontFamily: "inherit",
                color: "#585a4f",
                outline: "none",
                width: 200,
              }}
            />
            {(busca || codigoAtual || qAtual) && (
              <button
                type="button"
                onClick={limparBusca}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[#e4e1d6]/50"
              >
                <X className="w-3 h-3" style={{ color: "#6e7063" }} />
              </button>
            )}
          </div>

          {autocompleteOpen && sugestoes.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-1 bg-white border border-[#e4e1d6] rounded-xl shadow-lg overflow-hidden z-[100]"
              style={{ minWidth: 180 }}
            >
              {sugestoes.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => selecionarBairro(b)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#f5f5f3] transition-colors"
                  style={{ color: "#585a4f" }}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

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

        <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: "#e4e1d6" }} />

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
