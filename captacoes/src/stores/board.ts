"use client";

import { create } from "zustand";
import type { Captacao, Criterios, Decisao, Ordenacao, Status } from "@/types";
import { STATUSES, CRITERIOS_VAZIO } from "@/types";

type ByStatus = Record<Status, Captacao[]>;

export type Conexao = "conectando" | "online" | "offline";

function empty(): ByStatus {
  return Object.fromEntries(STATUSES.map((s) => [s, []])) as unknown as ByStatus;
}

const FILTRO_STATUS_KEY = "captacoes_filtro_status";

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
  criterios: CRITERIOS_VAZIO,
  setCriterios: (c) => set((state) => ({ criterios: { ...state.criterios, ...c } })),
  limparCriterios: () => set({ criterios: CRITERIOS_VAZIO }),
  ordenacao: "manual",
  setOrdenacao: (ordenacao) => set({ ordenacao }),
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
