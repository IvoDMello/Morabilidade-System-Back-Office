"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { Search, MapPin, Check, ChevronDown, ChevronUp } from "lucide-react";

type TipoNegocio = "venda" | "locacao" | "";

// Mesma ordem da FiltrosBar, pra quem vem do hero reencontrar a lista igual.
const TIPOS_IMOVEL = [
  { value: "apartamento", label: "Apartamento" },
  { value: "apartamento_terreo", label: "Apartamento térreo" },
  { value: "casa", label: "Casa" },
  { value: "casa_vila", label: "Casa de vila" },
  { value: "casa_condominio", label: "Casa de condomínio" },
  { value: "cobertura", label: "Cobertura" },
];

const TODOS_LABEL = "Todos os tipos";

// Radix reserva value="" para "sem seleção"; a opção "todos" usa um sentinela
// interno e o componente traduz de/para "" na borda (mesmo padrão da FiltrosBar).
const VALOR_TODOS = "__todos__";

export function HeroSearch() {
  const router = useRouter();
  const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>("");
  const [tipoImovel, setTipoImovel] = useState("");
  const [bairro, setBairro] = useState("");

  function montarUrl(negocio: TipoNegocio): string {
    const params = new URLSearchParams();
    if (negocio) params.set("tipo_negocio", negocio);
    if (tipoImovel === "apartamento_terreo") {
      params.set("tipo_imovel", "apartamento");
      params.set("andar_max", "1");
    } else if (tipoImovel) {
      params.set("tipo_imovel", tipoImovel);
    }
    if (bairro.trim()) params.set("bairro", bairro.trim());
    const qs = params.toString();
    return `/imoveis${qs ? `?${qs}` : ""}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(montarUrl(tipoNegocio));
  }

  function selecionarNegocio(v: TipoNegocio) {
    setTipoNegocio(v);
    if (v) router.push(montarUrl(v));
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      {/* Toggle Comprar / Alugar */}
      <div className="flex items-center justify-center mb-3">
        <div
          className="inline-flex items-center rounded-full p-1"
          role="tablist"
          style={{
            background: "rgba(20,22,18,0.34)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(252,252,252,0.14)",
          }}
        >
          <SegmentButton
            active={tipoNegocio === ""}
            onClick={() => selecionarNegocio("")}
          >
            Tudo
          </SegmentButton>
          <SegmentButton
            active={tipoNegocio === "venda"}
            onClick={() => selecionarNegocio("venda")}
          >
            Comprar
          </SegmentButton>
          <SegmentButton
            active={tipoNegocio === "locacao"}
            onClick={() => selecionarNegocio("locacao")}
          >
            Alugar
          </SegmentButton>
        </div>
      </div>

      {/* Card de busca */}
      <div className="bg-white rounded-2xl shadow-xl shadow-black/30 p-1.5 sm:p-2.5 flex flex-col sm:flex-row gap-1.5 sm:gap-2 items-stretch">
        {/* Tipo de imóvel — dropdown Radix, no mesmo padrão da barra de filtros
            da listagem: o select nativo abriria o menu do SO, sem CSS. */}
        <div className="flex-1 min-w-0">
          <Select.Root
            value={tipoImovel || VALOR_TODOS}
            onValueChange={(v) => setTipoImovel(v === VALOR_TODOS ? "" : v)}
          >
            <Select.Trigger
              type="button"
              aria-label="Tipo de imóvel"
              className={
                "group w-full flex items-center justify-between gap-2 pl-4 pr-3.5 py-2.5 sm:py-3.5 " +
                "rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 " +
                "data-[state=open]:bg-slate-100 border-0 cursor-pointer transition " +
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#585a4f]/30"
              }
            >
              <span className="truncate">
                <Select.Value />
              </span>
              <ChevronDown
                className={
                  "w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 " +
                  "group-data-[state=open]:rotate-180"
                }
              />
            </Select.Trigger>

            <Select.Portal>
              <Select.Content
                position="popper"
                sideOffset={6}
                align="start"
                className={
                  "z-[95] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl " +
                  "border border-[#e8e5da] bg-white shadow-lg shadow-[#26241c]/10"
                }
              >
                <Select.ScrollUpButton className="flex h-6 items-center justify-center bg-white text-slate-400">
                  <ChevronUp className="w-4 h-4" />
                </Select.ScrollUpButton>

                <Select.Viewport className="max-h-64 p-1">
                  <ItemTipo value={VALOR_TODOS} label={TODOS_LABEL} destaque />
                  <Select.Separator className="my-1 h-px bg-[#f1efe7]" />
                  {TIPOS_IMOVEL.map((t) => (
                    <ItemTipo key={t.value} value={t.value} label={t.label} />
                  ))}
                </Select.Viewport>

                <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </Select.ScrollDownButton>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Bairro / cidade, escondido no mobile para limpar o hero */}
        <div className="relative flex-1 min-w-0 hidden sm:block">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            placeholder="Ipanema, Leblon, Botafogo..."
            className="w-full pl-10 pr-3 py-2.5 sm:py-3.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border-0 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 placeholder:text-slate-400 placeholder:font-normal transition"
          />
        </div>

        {/* Botão Buscar */}
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 hover:shadow-lg whitespace-nowrap"
          style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
        >
          <Search className="w-4 h-4" />
          Buscar
        </button>
      </div>

    </form>
  );
}

// Mesmo desenho do Item da FiltrosBar — os dois dropdowns do site abrem igual.
function ItemTipo({
  value,
  label,
  destaque,
}: {
  value: string;
  label: string;
  destaque?: boolean;
}) {
  return (
    <Select.Item
      value={value}
      className={
        "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none " +
        "whitespace-nowrap transition-colors data-[highlighted]:bg-[#f5f4ee] " +
        "data-[state=checked]:font-medium data-[state=checked]:text-[#585a4f] " +
        (destaque ? "text-[#938d7c]" : "text-[#4a473d]")
      }
    >
      <Select.ItemText>{label}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
        <Check className="w-4 h-4 text-[#585a4f]" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
        active ? "shadow-md" : "text-white/70 hover:text-white"
      }`}
      style={active ? { backgroundColor: "#d8cb6a", color: "#3e4037" } : undefined}
    >
      {children}
    </button>
  );
}
