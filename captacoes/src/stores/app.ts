"use client";

import { create } from "zustand";
import type {
  Captacao,
  CaptacaoLista,
  Criterios,
  Decisao,
  Lista,
  OpinioesResumo,
  Ordenacao,
  Perfil,
  Status,
} from "@/types";
import { CRITERIOS_VAZIO, ORDENACAO_LABEL } from "@/types";

export type Conexao = "conectando" | "online" | "offline";

const ORDENACAO_KEY = "captacoes_ordenacao";
const CRITERIOS_KEY = "captacoes_criterios";
const LISTA_KEY = "captacoes_lista_ativa";

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
  return v && v in ORDENACAO_LABEL ? (v as Ordenacao) : "recentes";
}

function lerCriterios(): Criterios {
  const v = lerStorage(CRITERIOS_KEY);
  if (!v) return CRITERIOS_VAZIO;
  try {
    // Espalhar sobre o vazio garante que critério novo (versão nova do app)
    // não venha `undefined` de um storage gravado por uma versão antiga.
    return { ...CRITERIOS_VAZIO, ...(JSON.parse(v) as Partial<Criterios>) };
  } catch {
    return CRITERIOS_VAZIO;
  }
}

interface AppState {
  /** Todas as captações vivas, sem agrupamento — as abas derivam a etapa. */
  cards: Captacao[];
  listas: Lista[];
  vinculos: CaptacaoLista[];
  perfis: Perfil[];
  userId: string;
  userNome: string;

  /** Lista aberta na barra de pills; null = "Todas". */
  listaAtiva: string | null;
  setListaAtiva: (id: string | null) => void;

  filtro: string;
  setFiltro: (f: string) => void;
  criterios: Criterios;
  setCriterios: (c: Partial<Criterios>) => void;
  limparCriterios: () => void;
  ordenacao: Ordenacao;
  setOrdenacao: (o: Ordenacao) => void;

  conexao: Conexao;
  setConexao: (c: Conexao) => void;
  salvando: number;
  salvoEm: number | null;
  beginSave: () => void;
  endSave: (ok: boolean) => void;

  opinioes: Record<string, OpinioesResumo>;
  setOpinioes: (o: Record<string, OpinioesResumo>) => void;

  hidratar: (dados: {
    cards: Captacao[];
    listas: Lista[];
    vinculos: CaptacaoLista[];
    perfis: Perfil[];
    userId: string;
    userNome: string;
  }) => void;

  upsert: (card: Captacao) => void;
  remove: (id: string) => void;
  /** Patch otimista de uma captação (a confirmação vem pelo realtime). */
  patch: (id: string, campos: Partial<Captacao>) => void;
  decidir: (id: string, decisao: Decisao, paraStatus: Status) => void;
  find: (id: string) => Captacao | undefined;

  upsertLista: (l: Lista) => void;
  removerLista: (id: string) => void;
  /** Liga/desliga o vínculo captação↔lista de forma otimista. */
  setVinculo: (captacaoId: string, listaId: string, dentro: boolean, ordem?: number) => void;
  setOrdemVinculo: (captacaoId: string, listaId: string, ordem: number) => void;
}

export const useApp = create<AppState>((set, get) => ({
  cards: [],
  listas: [],
  vinculos: [],
  perfis: [],
  userId: "",
  userNome: "",

  listaAtiva: lerStorage(LISTA_KEY),
  setListaAtiva: (listaAtiva) => {
    gravarStorage(LISTA_KEY, listaAtiva ?? "");
    set({ listaAtiva: listaAtiva || null });
  },

  filtro: "",
  setFiltro: (filtro) => set({ filtro }),
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

  hidratar: (dados) => set(dados),

  upsert: (card) =>
    set((state) => {
      const i = state.cards.findIndex((c) => c.id === card.id);
      if (i === -1) return { cards: [...state.cards, card] };
      const cards = [...state.cards];
      cards[i] = card;
      return { cards };
    }),

  remove: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
      vinculos: state.vinculos.filter((v) => v.captacao_id !== id),
    })),

  patch: (id, campos) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, ...campos } : c)),
    })),

  decidir: (id, decisao, paraStatus) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id
          ? { ...c, decisao, status: paraStatus, decisao_em: new Date().toISOString() }
          : c
      ),
    })),

  find: (id) => get().cards.find((c) => c.id === id),

  upsertLista: (l) =>
    set((state) => {
      const i = state.listas.findIndex((x) => x.id === l.id);
      const listas = i === -1 ? [...state.listas, l] : state.listas.map((x) => (x.id === l.id ? l : x));
      return { listas: listas.sort((a, b) => a.ordem - b.ordem) };
    }),

  removerLista: (id) =>
    set((state) => ({
      listas: state.listas.filter((l) => l.id !== id),
      // Apagar uma lista remove a etiqueta, nunca a captação.
      vinculos: state.vinculos.filter((v) => v.lista_id !== id),
      listaAtiva: state.listaAtiva === id ? null : state.listaAtiva,
    })),

  setVinculo: (captacaoId, listaId, dentro, ordem = 0) =>
    set((state) => {
      const sem = state.vinculos.filter(
        (v) => !(v.captacao_id === captacaoId && v.lista_id === listaId)
      );
      if (!dentro) return { vinculos: sem };
      return {
        vinculos: [
          ...sem,
          { captacao_id: captacaoId, lista_id: listaId, ordem, criado_em: new Date().toISOString() },
        ],
      };
    }),

  setOrdemVinculo: (captacaoId, listaId, ordem) =>
    set((state) => ({
      vinculos: state.vinculos.map((v) =>
        v.captacao_id === captacaoId && v.lista_id === listaId ? { ...v, ordem } : v
      ),
    })),
}));
