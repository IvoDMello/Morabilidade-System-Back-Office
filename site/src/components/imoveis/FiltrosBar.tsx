"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { NAVBAR_ALTURA } from "@/components/layout/Navbar";
import {
  SlidersHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Hash,
} from "lucide-react";

const TIPOS_IMOVEL = [
  { value: "apartamento", label: "Apartamento" },
  { value: "apartamento_terreo", label: "Apartamento térreo" },
  { value: "casa", label: "Casa" },
  { value: "casa_vila", label: "Casa de vila" },
  { value: "casa_condominio", label: "Casa de condomínio" },
  { value: "cobertura", label: "Cobertura" },
];

const QUARTOS_OPTIONS = [
  { value: "1", label: "1+ quarto" },
  { value: "2", label: "2+ quartos" },
  { value: "3", label: "3+ quartos" },
  { value: "4", label: "4+ quartos" },
];

const ORDENAR_OPTIONS = [
  { value: "mais_antigo", label: "Mais antigos" },
  { value: "preco_asc", label: "Menor preço" },
  { value: "preco_desc", label: "Maior preço" },
  { value: "area_desc", label: "Maior área útil" },
  { value: "area_asc", label: "Menor área útil" },
];

const DIVIDER = "1px solid rgba(86,87,70,0.15)";
const FUNDO = "#f6f4ec";

// Largura do esmaecimento nas pontas do trilho. Sem barra de rolagem visível,
// é ele que sinaliza que há mais filtros fora da tela.
const FADE = 44;

// Faz a célula dividir igualmente a sobra de espaço da barra: base 0 + grow 1
// reparte por igual, e o min-width impede que ela encolha abaixo do conteúdo —
// então na tela estreita as células voltam ao tamanho natural e o trilho rola.
const CELULA_ELASTICA: React.CSSProperties = { flex: "1 1 0%", minWidth: "max-content" };

// Radix reserva value="" para "sem seleção"; a opção "todos" usa um sentinela
// interno e o componente traduz de/para "" na borda (mesmo padrão do painel).
const VALOR_TODOS = "__todos__";

interface Option {
  value: string;
  label: string;
}

// Célula plana da barra com dropdown customizado (Radix), no mesmo padrão do
// FiltroSelect do painel web — o select nativo abriria o menu do SO, sem CSS.
function SelectCell({
  displayLabel,
  displayLabelShort,
  active = false,
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  todosLabel,
  elastica = false,
  className = "",
  style,
}: {
  displayLabel: string;
  displayLabelShort?: string;
  active?: boolean;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** Rótulo da opção que limpa o filtro, ex.: "Todos os tipos". */
  todosLabel: string;
  /** Divide a sobra de espaço da barra por igual com as outras elásticas. */
  elastica?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Select.Root
      value={value || VALOR_TODOS}
      onValueChange={(v) => onChange(v === VALOR_TODOS ? "" : v)}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={
        "group flex items-center cursor-pointer transition-colors " +
        (elastica ? "" : "flex-shrink-0 ") +
        "focus:outline-none focus-visible:bg-[#ece9dc] data-[state=open]:bg-[#ece9dc] " +
        "disabled:cursor-default " +
        className
        }
        style={{
          border: "none",
          background: "transparent",
          padding: "0 clamp(14px,2vw,20px)",
          fontFamily: "inherit",
          borderRight: DIVIDER,
          ...(elastica ? CELULA_ELASTICA : null),
          ...style,
        }}
      >
        <span
          className="flex items-center gap-2"
          style={{
            fontSize: 13.5,
            color: active ? "#23241c" : "#3d3e33",
            fontWeight: active ? 600 : 400,
            whiteSpace: "nowrap",
          }}
        >
          {displayLabelShort ? (
            <>
              <span className="hidden sm:inline">{displayLabel}</span>
              <span className="sm:hidden">{displayLabelShort}</span>
            </>
          ) : (
            displayLabel
          )}
          <ChevronDown
            className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
            style={{ color: "#9a9a8d" }}
          />
        </span>
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
            <Item value={VALOR_TODOS} label={todosLabel} destaque />
            {options.length > 0 && <Select.Separator className="my-1 h-px bg-[#f1efe7]" />}
            {options.map((op) => (
              <Item key={op.value} value={op.value} label={op.label} />
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function Item({ value, label, destaque }: { value: string; label: string; destaque?: boolean }) {
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

interface Props {
  total: number;
  bairros?: string[];
}

export function FiltrosBar({ total, bairros = [] }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const tipoImovelUrl = params.get("tipo_imovel") ?? "";
  const apenasTerreo = params.get("andar_max") === "1";
  const tipoImovelInicial =
    tipoImovelUrl === "apartamento" && apenasTerreo ? "apartamento_terreo" : tipoImovelUrl;
  const [tipoImovel, setTipoImovel] = useState(tipoImovelInicial);
  const [dormitorios, setDormitorios] = useState(params.get("dormitorios_min") ?? "");
  const [ordenar, setOrdenar] = useState(params.get("ordenar") ?? "");
  const [codigoInput, setCodigoInput] = useState(params.get("codigo") ?? "");

  const bairrosAtuais = params.getAll("bairro");
  const codigoAtual = params.get("codigo") ?? "";

  // Esmaecimento das pontas: só aparece do lado em que ainda há conteúdo.
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [pontas, setPontas] = useState({ esquerda: false, direita: false });

  const medirPontas = useCallback(() => {
    const el = trilhoRef.current;
    if (!el) return;
    const restante = el.scrollWidth - el.clientWidth - el.scrollLeft;
    setPontas((atual) => {
      const esquerda = el.scrollLeft > 4;
      const direita = restante > 4;
      return atual.esquerda === esquerda && atual.direita === direita
        ? atual
        : { esquerda, direita };
    });
  }, []);

  useEffect(() => {
    const el = trilhoRef.current;
    if (!el) return;
    medirPontas();
    el.addEventListener("scroll", medirPontas, { passive: true });
    // Reage a mudança de viewport e a chips de bairro entrando/saindo.
    const observer = new ResizeObserver(medirPontas);
    observer.observe(el);
    for (const filho of Array.from(el.children)) observer.observe(filho);
    return () => {
      el.removeEventListener("scroll", medirPontas);
      observer.disconnect();
    };
  }, [medirPontas, params, total]);

  const mascara = (() => {
    if (!pontas.esquerda && !pontas.direita) return undefined;
    const paradas = [
      pontas.esquerda ? "transparent 0" : "#000 0",
      pontas.esquerda ? `#000 ${FADE}px` : null,
      pontas.direita ? `#000 calc(100% - ${FADE}px)` : null,
      pontas.direita ? "transparent 100%" : "#000 100%",
    ].filter(Boolean);
    return `linear-gradient(to right, ${paradas.join(", ")})`;
  })();

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

  function handleTipo(v: string) {
    setTipoImovel(v);
    if (v === "apartamento_terreo") {
      router.push(buildUrl({ tipo_imovel: "apartamento", andar_max: "1" }));
    } else {
      router.push(buildUrl({ tipo_imovel: v, andar_max: "" }));
    }
  }

  function handleQuartos(v: string) {
    setDormitorios(v);
    router.push(buildUrl({ dormitorios_min: v }));
  }

  function handleOrdenar(v: string) {
    setOrdenar(v);
    router.push(buildUrl({ ordenar: v }));
  }

  function handleBairro(v: string) {
    if (v === "") {
      // Opção "Todos os bairros" limpa a seleção.
      if (bairrosAtuais.length > 0) router.push(buildUrl({ bairro: [] }));
      return;
    }
    if (bairrosAtuais.includes(v)) return;
    router.push(buildUrl({ bairro: [...bairrosAtuais, v] }));
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
    !!tipoImovel ||
    bairrosAtuais.length > 0 ||
    !!dormitorios ||
    !!codigoAtual ||
    !!ordenar;

  function handleLimpar() {
    setTipoImovel("");
    setDormitorios("");
    setCodigoInput("");
    setOrdenar("");
    router.push("/imoveis?page=1");
  }

  // Só mostra no dropdown os bairros que ainda não estão nos chips.
  const bairrosDisponiveis = bairros.filter((b) => !bairrosAtuais.includes(b));

  const tipoSelecionado = TIPOS_IMOVEL.find((t) => t.value === tipoImovel);
  const quartosSelecionado = QUARTOS_OPTIONS.find((o) => o.value === dormitorios);
  const ordenarLabel =
    ORDENAR_OPTIONS.find((o) => o.value === ordenar)?.label ?? "Mais recentes";
  const totalLabel = `${total} ${total === 1 ? "imóvel" : "imóveis"}`;

  const bairroLabel =
    bairrosAtuais.length === 0
      ? "Todos os bairros"
      : bairrosDisponiveis.length === 0
        ? "Todos selecionados"
        : "+ adicionar bairro";
  const bairroLabelShort =
    bairrosAtuais.length === 0
      ? "Bairros"
      : bairrosDisponiveis.length === 0
        ? "Todos"
        : "+ bairro";

  return (
    <div
      className="md:sticky z-[40] md:z-[90]"
      style={{
        top: NAVBAR_ALTURA,
        backgroundColor: FUNDO,
        borderTop: DIVIDER,
        borderBottom: DIVIDER,
      }}
    >
      <div
        ref={trilhoRef}
        className="hide-scrollbar flex items-stretch overflow-x-auto"
        style={{
          height: 56,
          maxWidth: 1176,
          margin: "0 auto",
          padding: "0 clamp(20px,4vw,64px)",
          WebkitOverflowScrolling: "touch",
          maskImage: mascara,
          WebkitMaskImage: mascara,
        }}
      >
        {/* Filtros (rótulo) */}
        <span
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "#3d3e33",
            paddingRight: "clamp(14px,2vw,22px)",
            borderRight: DIVIDER,
            whiteSpace: "nowrap",
          }}
        >
          <SlidersHorizontal className="w-4 h-4" style={{ color: "#3d3e33" }} />
          Filtros
        </span>

        {/* Código */}
        <div
          className="relative flex items-center focus-within:bg-[#ece9dc] transition-colors"
          style={{
            borderRight: DIVIDER,
            // Mesmo padding das demais: a sobra é repartida entre as caixas de
            // conteúdo, então padding diferente deixaria esta célula menor.
            padding: "0 clamp(14px,2vw,20px)",
            ...CELULA_ELASTICA,
          }}
        >
          <Hash className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#a39f8d" }} />
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
            className="placeholder:text-[#a39f8d]"
            style={{
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13,
              letterSpacing: "0.08em",
              fontFamily: "inherit",
              color: "#3d3e33",
              width: 88,
              padding: "0 2px 0 7px",
              textTransform: "uppercase",
            }}
          />
          {codigoInput && (
            <button
              type="button"
              onClick={limparCodigo}
              aria-label="Limpar código"
              className="p-0.5 rounded-full hover:bg-[#e4e1d6]/50 flex-shrink-0"
            >
              <X className="w-3 h-3" style={{ color: "#6e7063" }} />
            </button>
          )}
        </div>

        {/* Tipo imóvel */}
        <SelectCell
          elastica
          displayLabel={tipoSelecionado?.label ?? "Todos os tipos"}
          displayLabelShort={tipoSelecionado ? undefined : "Tipos"}
          active={!!tipoSelecionado}
          options={TIPOS_IMOVEL}
          value={tipoImovel}
          onChange={handleTipo}
          ariaLabel="Tipo de imóvel"
          todosLabel="Todos os tipos"
        />

        {/* Bairro, seleção múltipla (ao selecionar, vira chip) */}
        {bairros.length > 0 && (
          <SelectCell
            elastica
            displayLabel={bairroLabel}
            displayLabelShort={bairroLabelShort}
            active={bairrosAtuais.length > 0}
            options={bairrosDisponiveis.map((b) => ({ value: b, label: b }))}
            value=""
            onChange={handleBairro}
            ariaLabel="Adicionar bairro"
            todosLabel="Todos os bairros"
          />
        )}

        {/* Chips dos bairros selecionados */}
        {bairrosAtuais.length > 0 && (
          <div
            className="flex items-center gap-2 flex-shrink-0"
            style={{ padding: "0 clamp(12px,2vw,16px)", borderRight: DIVIDER }}
          >
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
          </div>
        )}

        {/* Quartos (dormitórios mínimos) */}
        <SelectCell
          elastica
          displayLabel={quartosSelecionado?.label ?? "Quartos"}
          active={!!quartosSelecionado}
          options={QUARTOS_OPTIONS}
          value={dormitorios}
          onChange={handleQuartos}
          ariaLabel="Número mínimo de quartos"
          todosLabel="Qualquer número"
        />

        {hasFilters && (
          <button
            onClick={handleLimpar}
            className="flex items-center gap-1 flex-shrink-0 hover:opacity-70 transition-opacity"
            style={{
              padding: "0 clamp(12px,2vw,16px)",
              fontSize: 13,
              fontFamily: "inherit",
              backgroundColor: "transparent",
              border: "none",
              borderRight: DIVIDER,
              color: "#7a7c72",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            aria-label="Limpar filtros"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}

        {/* Ordenar + total. As células elásticas já absorvem toda a sobra, então
            ele encosta na anterior e a divisória dela é que faz a separação. */}
        <SelectCell
          style={{ borderRight: "none" }}
          displayLabel={`${ordenarLabel} · ${totalLabel}`}
          options={ORDENAR_OPTIONS}
          value={ordenar}
          onChange={handleOrdenar}
          ariaLabel="Ordenar resultados"
          todosLabel="Mais recentes"
        />
      </div>
    </div>
  );
}
