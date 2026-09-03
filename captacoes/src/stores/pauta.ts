"use client";

import { create } from "zustand";
import type { Pauta, PautaItem } from "@/types";

/** Itens agrupados por cartão de pauta, sempre ordenados por `ordem`. */
type ByPauta = Record<string, PautaItem[]>;

function ordenar<T extends { ordem: number }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.ordem - b.ordem);
}

function agrupar(itens: PautaItem[]): ByPauta {
  const out: ByPauta = {};
  for (const i of itens) (out[i.pauta_id] ??= []).push(i);
  for (const k of Object.keys(out)) out[k] = ordenar(out[k]);
  return out;
}

interface PautaState {
  pautas: Pauta[];
  itens: ByPauta;
  /** Carga inicial (server component) e recargas completas. */
  setTudo: (pautas: Pauta[], itens: PautaItem[]) => void;
  upsertPauta: (p: Pauta) => void;
  removePauta: (id: string) => void;
  upsertItem: (i: PautaItem) => void;
  removeItem: (id: string, pautaId: string) => void;
  /** Reordena um cartão na raia sem esperar o servidor. */
  moverPauta: (id: string, ordem: number) => void;
  /** Move um item (mesma pauta ou entre pautas) sem esperar o servidor. */
  moverItem: (id: string, paraPauta: string, ordem: number) => void;
  itensDe: (pautaId: string) => PautaItem[];
  acharItem: (id: string) => PautaItem | undefined;
}

const VAZIO: PautaItem[] = [];

export const usePauta = create<PautaState>((set, get) => ({
  pautas: [],
  itens: {},
  setTudo: (pautas, itens) => set({ pautas: ordenar(pautas), itens: agrupar(itens) }),
  upsertPauta: (p) =>
    set((s) => ({ pautas: ordenar([...s.pautas.filter((x) => x.id !== p.id), p]) })),
  removePauta: (id) =>
    set((s) => {
      const itens = { ...s.itens };
      delete itens[id];
      return { pautas: s.pautas.filter((p) => p.id !== id), itens };
    }),
  upsertItem: (i) =>
    set((s) => {
      // Um upsert pode chegar depois de o item ter mudado de pauta (realtime):
      // tira de todas as listas antes de inserir na certa.
      const itens: ByPauta = {};
      for (const [k, lista] of Object.entries(s.itens)) itens[k] = lista.filter((x) => x.id !== i.id);
      itens[i.pauta_id] = ordenar([...(itens[i.pauta_id] ?? []), i]);
      return { itens };
    }),
  removeItem: (id, pautaId) =>
    set((s) => ({
      itens: { ...s.itens, [pautaId]: (s.itens[pautaId] ?? []).filter((x) => x.id !== id) },
    })),
  moverPauta: (id, ordem) =>
    set((s) => ({ pautas: ordenar(s.pautas.map((p) => (p.id === id ? { ...p, ordem } : p))) })),
  moverItem: (id, paraPauta, ordem) =>
    set((s) => {
      const atual = Object.values(s.itens).flat().find((x) => x.id === id);
      if (!atual) return s;
      const movido = { ...atual, pauta_id: paraPauta, ordem };
      const itens: ByPauta = {};
      for (const [k, lista] of Object.entries(s.itens)) itens[k] = lista.filter((x) => x.id !== id);
      itens[paraPauta] = ordenar([...(itens[paraPauta] ?? []), movido]);
      return { itens };
    }),
  // Referência estável quando a pauta não tem itens: um [] novo a cada
  // chamada faria o seletor do zustand re-renderizar em loop.
  itensDe: (pautaId) => get().itens[pautaId] ?? VAZIO,
  acharItem: (id) => Object.values(get().itens).flat().find((x) => x.id === id),
}));
