"use client";

import { create } from "zustand";
import type { Captacao, Criterios, Decisao, Ordenacao, OpinioesResumo, Status } from "@/types";
import { STATUSES, CRITERIOS_VAZIO, ORDENACAO_LABEL } from "@/types";

type ByStatus = Record<Status, Captacao[]>;

export type Conexao = "conectando" | "online" | "offline";

function empty(): ByStatus {
  return Object.fromEntries(STATUSES.map((s) => [s, []])) as unknown as ByStatus;
}

const FILTRO_STATUS_KEY = "captacoes_filtro_status";
const ORDENACAO_KEY = "captacoes_ordenacao";
const CRITERIOS_KEY = "captacoes_criterios";

/** Leitura/gravação best effort no sessionStorage (SSR e modo privado seguros). */
function lerStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function gravarStorage(key: string, valor: string): void {
  try {
    window.sessionStorage.setItem(key, valor);
  } catch {
    // best effort
  }
}

function lerOrdenacao(): Ordenacao {
  const v = lerStorage(ORDENACAO_KEY);
  return v && v in ORDENACAO_LABEL ? (v as Ordenacao) : "manual";
}

function lerCriterios(): Criterios {
  const v = lerStorage(CRITERIOS_KEY);
  if (!v) return CRITERIOS_VAZIO;
  try {
    return { ...CRITERIOS_VAZIO, ...(JSON.parse(v) as Partial<Criterios>) };
  } catch {
    return CRITERIOS_VAZIO;
  }
}

function lerFiltroStatus(): "all" | Status {
  // sessionStorage sobrevive ao reload (F5 no detalhe) mas não vaza entre
  // abas/sessões. Guard de window: o módulo também é avaliado no SSR.
  if (typeof window === "undefined") return "all";
  try {
    const v = window.sessionStorage.getItem(FILTRO_STATUS_KEY);
    if (v && (v === "all" || (STATUSES as readonly string[]).includes(v))) return v as "all" | Status;
  } catch {
    // storage bloqueado (modo privado etc.) — segue no padrão.
  }
  return "all";
}

function gravarFiltroStatus(v: "all" | Status): void {
  try {
    window.sessionStorage.setItem(FILTRO_STATUS_KEY, v);
  } catch {
    // best effort
  }
}

function group(cards: Captacao[]): ByStatus {
  const out = empty();
  for (const c of cards) out[c.status].push(c);
  for (const s of STATUSES) out[s].sort((a, b) => a.ordem - b.ordem);
  return out;
}

interface BoardState {
  byStatus: ByStatus;
  filtro: string;
  setFiltro: (f: string) => void;
  /** Pill/aba de status ativa no quadro mobile (persiste ao navegar pro detalhe e voltar). */
  filtroStatus: "all" | Status;
  setFiltroStatus: (s: "all" | Status) => void;
  criterios: Criterios;
  setCriterios: (c: Partial<Criterios>) => void;
  limparCriterios: () => void;
  ordenacao: Ordenacao;
  setOrdenacao: (o: Ordenacao) => void;
  /** Conexão do tempo real / rede. */
  conexao: Conexao;
  setConexao: (c: Conexao) => void;
  /** Nº de gravações em andamento (otimistas aguardando o servidor). */
  salvando: number;
  /** Marca de tempo da última gravação concluída com sucesso. */
  salvoEm: number | null;
  beginSave: () => void;
  endSave: (ok: boolean) => void;
  /** Contadores de opiniões por captação (badge 💬 do quadro). */
  opinioes: Record<string, OpinioesResumo>;
  setOpinioes: (o: Record<string, OpinioesResumo>) => void;
  setCards: (cards: Captacao[]) => void;
  upsert: (card: Captacao) => void;
  remove: (id: string) => void;
  /** Move otimista: atualiza a UI antes da confirmação do servidor. */
  applyMove: (id: string, toStatus: Status, ordem: number, decisao?: Decisao | null) => void;
  find: (id: string) => Captacao | undefined;
}

export const useBoard = create<BoardState>((set, get) => ({
  byStatus: empty(),
  filtro: "",
  setFiltro: (filtro) => set({ filtro }),
  filtroStatus: lerFiltroStatus(),
  setFiltroStatus: (filtroStatus) => {
    gravarFiltroStatus(filtroStatus);
    set({ filtroStatus });
  },
  criterios: lerCriterios(),
  setCriterios: (c) =>
    set((state) => {
      const criterios = { ...state.criterios, ...c };
      gravarStorage(CRITERIOS_KEY, JSON.stringify(criterios));
      return { criterios };
    }),
  limparCriterios: () => {
    gravarStorage(CRITERIOS_KEY, JSON.stringify(CRITERIOS_VAZIO));
    set({ criterios: CRITERIOS_VAZIO });
  },
  ordenacao: lerOrdenacao(),
  setOrdenacao: (ordenacao) => {
    gravarStorage(ORDENACAO_KEY, ordenacao);
    set({ ordenacao });
  },
  conexao: "conectando",
  setConexao: (conexao) => set({ conexao }),
  salvando: 0,
  salvoEm: null,
  beginSave: () => set((s) => ({ salvando: s.salvando + 1 })),
  endSave: (ok) =>
    set((s) => ({
      salvando: Math.max(0, s.salvando - 1),
      salvoEm: ok ? Date.now() : s.salvoEm,
    })),
  opinioes: {},
  setOpinioes: (opinioes) => set({ opinioes }),
  setCards: (cards) => set({ byStatus: group(cards) }),
  upsert: (card) =>
    set((state) => {
      const all = Object.values(state.byStatus).flat().filter((c) => c.id !== card.id);
      all.push(card);
      return { byStatus: group(all) };
    }),
  remove: (id) =>
    set((state) => ({
      byStatus: group(Object.values(state.byStatus).flat().filter((c) => c.id !== id)),
    })),
  applyMove: (id, toStatus, ordem, decisao) =>
    set((state) => {
      const all = Object.values(state.byStatus).flat();
      const card = all.find((c) => c.id === id);
      if (!card) return state;
      const next = all.map((c) =>
        c.id === id
          ? { ...c, status: toStatus, ordem, ...(decisao !== undefined ? { decisao } : {}) }
          : c
      );
      return { byStatus: group(next) };
    }),
  find: (id) => Object.values(get().byStatus).flat().find((c) => c.id === id),
}));
