"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ListFilter, X } from "lucide-react";
import { toast } from "sonner";
import { AppHeader, contarCriterios } from "@/components/app/AppHeader";
import { ListaPills } from "@/components/app/ListaPills";
import { CaptacaoRow } from "@/components/app/CaptacaoRow";
import { FiltrosSheet } from "@/components/app/FiltrosSheet";
import { VazioAprovadas } from "@/components/app/Vazios";
import { useApp } from "@/stores/app";
import { contadores, hojeLocal } from "@/lib/contadores";
import { etapaDaCaptacao, foiGravada } from "@/lib/etapa";
import { filtrarCaptacoes, filtrarPorCriterios } from "@/lib/filter";
import { indexarListas, ordemNaLista } from "@/lib/listas";
import { moverNaSequencia } from "@/lib/listas-api";
import { vizinhosDoDestino } from "@/lib/order";
import { ordenarCaptacoes } from "@/lib/sort";
import { CRITERIOS_VAZIO, ORDENACAO_LABEL, type Ordenacao } from "@/types";
import { cn, CONTAINER } from "@/lib/utils";

const ORDENACOES = Object.keys(ORDENACAO_LABEL) as Ordenacao[];

export default function AprovadasPage() {
  const {
    cards,
    listas,
    vinculos,
    listaAtiva,
    filtro,
    criterios,
    setCriterios,
    limparCriterios,
    ordenacao,
    setOrdenacao,
    userId,
  } = useApp();
  const [filtrosAberto, setFiltrosAberto] = useState(false);

  const aprovadas = useMemo(() => cards.filter((c) => etapaDaCaptacao(c) === "aprovada"), [cards]);
  const nums = useMemo(() => contadores(cards, hojeLocal(), userId), [cards, userId]);
  const porCaptacao = useMemo(() => indexarListas(vinculos, listas), [vinculos, listas]);

  const listasPorCaptacao = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos) {
      const atual = m.get(v.captacao_id);
      if (atual) atual.push(v.lista_id);
      else m.set(v.captacao_id, [v.lista_id]);
    }
    return m;
  }, [vinculos]);

  // Pill de lista ativa é um filtro a mais, aplicado depois da busca.
  const daLista = useMemo(() => {
    if (!listaAtiva) return aprovadas;
    const ids = new Set(vinculos.filter((v) => v.lista_id === listaAtiva).map((v) => v.captacao_id));
    return aprovadas.filter((c) => ids.has(c.id));
  }, [aprovadas, vinculos, listaAtiva]);

  const visiveis = useMemo(
    () => filtrarPorCriterios(filtrarCaptacoes(daLista, filtro), criterios, { listasPorCaptacao }),
    [daLista, filtro, criterios, listasPorCaptacao]
  );

  const ordemPorId = useMemo(
    () => (listaAtiva ? ordemNaLista(vinculos, listaAtiva) : undefined),
    [vinculos, listaAtiva]
  );

  const fila = useMemo(
    () => ordenarCaptacoes(visiveis, ordenacao, ordemPorId),
    [visiveis, ordenacao, ordemPorId]
  );

  const emSequencia = ordenacao === "sequencia";
  const nomeDaLista = listas.find((l) => l.id === listaAtiva)?.nome ?? "Todas";
  const gravadas = fila.filter(foiGravada).length;
  const filtrosAtivos = contarCriterios(criterios);
  const buscando = filtro.trim().length > 0;

  /** Troca duas posições vizinhas na fila e persiste a nova ordem. */
  async function mover(origem: number, direcao: -1 | 1) {
    const destino = origem + direcao;
    if (destino < 0 || destino >= fila.length) return;
    const ordens = fila.map((c) => (ordemPorId ? (ordemPorId.get(c.id) ?? 0) : c.ordem));
    const { antes, depois } = vizinhosDoDestino(ordens, origem, destino);
    const ok = await moverNaSequencia(fila[origem].id, listaAtiva, antes, depois);
    if (!ok) toast.error("Não foi possível salvar a nova sequência.");
  }

  return (
    <>
      <AppHeader
        titulo="Aprovadas"
        contadores={nums}
        onAbrirFiltros={() => setFiltrosAberto(true)}
        subtitulo={
          <>
            {aprovadas.length} aprovadas
            {nums.agenda > 0 && ` · ${nums.agenda} aguardando agendamento`}
          </>
        }
      />

      <ListaPills visiveis={aprovadas} />

      <div className={cn(CONTAINER, "flex flex-none items-center justify-between gap-3 px-[18px] pb-1 pt-3 lg:px-6")}>
        <label className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Ordenar</span>
          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
            className={cn(
              "h-9 rounded-[10px] border pl-8 pr-2.5 text-[12.5px] font-semibold",
              emSequencia ? "border-foreground bg-foreground text-background" : "border-input bg-card text-foreground"
            )}
          >
            {ORDENACOES.map((o) => (
              <option key={o} value={o}>
                {ORDENACAO_LABEL[o]}
              </option>
            ))}
          </select>
        </label>

        <span className="text-xs text-muted-foreground">
          {emSequencia
            ? `${fila.length} na fila · ${gravadas} já gravadas`
            : `${fila.length} ${fila.length === 1 ? "captação" : "captações"}`}
        </span>
      </div>

      {emSequencia && (
        <div className={cn(CONTAINER, "flex-none px-[18px] pt-2 lg:px-6")}>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sequência de gravação
          </p>
          <p className="mt-0.5 font-serif text-lg font-semibold text-foreground">{nomeDaLista}</p>
        </div>
      )}

      {(filtrosAtivos > 0 || buscando) && (
        <div className={cn(CONTAINER, "no-scrollbar flex flex-none items-center gap-2 overflow-x-auto px-[18px] pt-3 lg:px-6")}>
          <ChipsAtivos />
          <button
            type="button"
            onClick={limparCriterios}
            className="flex-none text-xs font-semibold text-destructive"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <div
        className={cn(
          CONTAINER,
          "no-scrollbar min-h-0 flex-1 overflow-y-auto px-[18px] pb-5 pt-3 lg:px-6 lg:pb-8",
          "flex flex-col gap-2.5",
          // Sequência é uma fila numerada: em duas colunas o «1, 2, 3» passaria
          // a serpentear pela tela e a ordem deixaria de ser óbvia.
          !emSequencia && "xl:grid xl:grid-cols-2 xl:content-start xl:gap-3"
        )}
      >
        {fila.length === 0 ? (
          <div className="xl:col-span-2">
            <VazioAprovadas
              filtrando={filtrosAtivos > 0 || buscando || listaAtiva !== null}
              total={aprovadas.length}
              onLimpar={() => {
                limparCriterios();
                setCriterios(CRITERIOS_VAZIO);
              }}
            />
          </div>
        ) : (
          fila.map((c, i) => (
            <CaptacaoRow
              key={c.id}
              captacao={c}
              listas={porCaptacao.get(c.id) ?? []}
              posicao={emSequencia ? i + 1 : undefined}
              onSubir={emSequencia && i > 0 ? () => mover(i, -1) : undefined}
              onDescer={emSequencia && i < fila.length - 1 ? () => mover(i, 1) : undefined}
            />
          ))
        )}
      </div>

      <FiltrosSheet open={filtrosAberto} onOpenChange={setFiltrosAberto} universo={daLista} />
    </>
  );
}

/** Filtros aplicados viram chips removíveis no topo da lista. */
function ChipsAtivos() {
  const { criterios, setCriterios, filtro, setFiltro, listas } = useApp();

  const chips: { chave: string; texto: string; limpar: () => void }[] = [];

  if (filtro.trim()) chips.push({ chave: "busca", texto: `"${filtro.trim()}"`, limpar: () => setFiltro("") });

  if (criterios.listas.length) {
    const nomes = criterios.listas
      .map((id) => listas.find((l) => l.id === id)?.nome)
      .filter(Boolean)
      .join(", ");
    chips.push({ chave: "listas", texto: nomes, limpar: () => setCriterios({ listas: [] }) });
  }
  if (criterios.bairros.length) {
    chips.push({
      chave: "bairros",
      texto: criterios.bairros.join(", "),
      limpar: () => setCriterios({ bairros: [] }),
    });
  }
  if (criterios.valorMin != null || criterios.valorMax != null) {
    chips.push({
      chave: "valor",
      texto: faixaTexto("R$", criterios.valorMin, criterios.valorMax),
      limpar: () => setCriterios({ valorMin: null, valorMax: null }),
    });
  }
  if (criterios.metragemMin != null || criterios.metragemMax != null) {
    chips.push({
      chave: "metragem",
      texto: faixaTexto("", criterios.metragemMin, criterios.metragemMax, " m²"),
      limpar: () => setCriterios({ metragemMin: null, metragemMax: null }),
    });
  }
  for (const s of criterios.situacoes) {
    chips.push({
      chave: `sit-${s}`,
      texto: SITUACAO_CURTO[s],
      limpar: () => setCriterios({ situacoes: criterios.situacoes.filter((x) => x !== s) }),
    });
  }

  return (
    <>
      {chips.map((c) => (
        <span
          key={c.chave}
          className="flex h-7 flex-none items-center gap-1.5 whitespace-nowrap rounded-lg border bg-muted pl-2.5 pr-1.5 text-xs font-semibold text-foreground"
        >
          {c.texto}
          <button
            type="button"
            onClick={c.limpar}
            aria-label={`Remover filtro ${c.texto}`}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-border text-foreground"
          >
            <X className="h-2.5 w-2.5" strokeWidth={3.4} />
          </button>
        </span>
      ))}
      <ListFilter className="hidden" aria-hidden />
    </>
  );
}

const SITUACAO_CURTO: Record<string, string> = {
  sem_agendamento: "Sem agendamento",
  visita_agendada: "Visita agendada",
  gravacao_agendada: "Gravação agendada",
  gravada: "Gravada",
  nao_gravada: "Não gravada",
  no_sistema: "No sistema",
  paradas: "Paradas 3+ dias",
};

function faixaTexto(prefixo: string, min: number | null, max: number | null, sufixo = ""): string {
  const fmt = (v: number) => `${prefixo ? `${prefixo} ` : ""}${v.toLocaleString("pt-BR")}${sufixo}`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  return `Até ${fmt(max!)}`;
}
