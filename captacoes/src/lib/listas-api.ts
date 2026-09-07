"use client";

import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import { useApp } from "@/stores/app";
import type { CorLista, Lista } from "@/types";

/**
 * Escritas das listas. Todas seguem o mesmo desenho do resto do app: aplica
 * otimista no store, grava, e deixa o realtime confirmar. Erro devolve
 * `false` para quem chamou avisar o usuário e desfazer.
 */

/** Ordem no fim da barra de listas. */
function proximaOrdem(): number {
  const listas = useApp.getState().listas;
  const maior = listas.reduce((m, l) => Math.max(m, l.ordem), 0);
  return orderBetween(maior, null);
}

export async function criarLista(nome: string, cor: CorLista): Promise<Lista | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lista")
    .insert({ nome: nome.trim(), cor, permanente: false, ordem: proximaOrdem() })
    .select("*")
    .single();

  if (error || !data) return null;
  const lista = data as Lista;
  useApp.getState().upsertLista(lista);
  return lista;
}

export async function editarLista(
  id: string,
  campos: { nome?: string; cor?: CorLista }
): Promise<boolean> {
  const patch = campos.nome !== undefined ? { ...campos, nome: campos.nome.trim() } : campos;
  const supabase = createClient();
  const { data, error } = await supabase.from("lista").update(patch).eq("id", id).select("*").single();
  if (error || !data) return false;
  useApp.getState().upsertLista(data as Lista);
  return true;
}

/**
 * Apagar a lista remove a ETIQUETA, nunca a captação — o `on delete cascade`
 * da migration 0021 cai só sobre `captacao_lista`. A interface diz isso em
 * voz alta antes de confirmar.
 */
export async function excluirLista(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("lista").delete().eq("id", id);
  if (error) return false;
  useApp.getState().removerLista(id);
  return true;
}

/** Quantas captações perdem a etiqueta se esta lista for apagada. */
export function quantasNaLista(listaId: string): number {
  return useApp.getState().vinculos.filter((v) => v.lista_id === listaId).length;
}

/** Põe ou tira uma captação de uma lista. Entra sempre no fim da sequência. */
export async function alternarLista(
  captacaoId: string,
  listaId: string,
  dentro: boolean
): Promise<boolean> {
  const store = useApp.getState();
  const supabase = createClient();

  if (!dentro) {
    store.setVinculo(captacaoId, listaId, false);
    const { error } = await supabase
      .from("captacao_lista")
      .delete()
      .eq("captacao_id", captacaoId)
      .eq("lista_id", listaId);
    if (error) {
      store.setVinculo(captacaoId, listaId, true);
      return false;
    }
    return true;
  }

  const daLista = store.vinculos.filter((v) => v.lista_id === listaId);
  const maior = daLista.reduce((m, v) => Math.max(m, v.ordem), 0);
  const ordem = orderBetween(daLista.length ? maior : null, null);

  store.setVinculo(captacaoId, listaId, true, ordem);
  const { error } = await supabase
    .from("captacao_lista")
    .upsert({ captacao_id: captacaoId, lista_id: listaId, ordem });
  if (error) {
    store.setVinculo(captacaoId, listaId, false);
    return false;
  }
  return true;
}

/**
 * Move uma captação na sequência de gravação. Com `listaId`, mexe na ordem
 * DAQUELA lista; sem ele, na ordem geral do cartão (visão "Todas").
 *
 * `antes`/`depois` são as ordens dos vizinhos do destino — fractional
 * indexing, um UPDATE só, sem reindexar a fila inteira.
 */
export async function moverNaSequencia(
  captacaoId: string,
  listaId: string | null,
  antes: number | null,
  depois: number | null
): Promise<boolean> {
  const ordem = orderBetween(antes, depois);
  const store = useApp.getState();
  const supabase = createClient();

  if (listaId) {
    const anterior = store.vinculos.find(
      (v) => v.captacao_id === captacaoId && v.lista_id === listaId
    )?.ordem;
    store.setOrdemVinculo(captacaoId, listaId, ordem);
    const { error } = await supabase
      .from("captacao_lista")
      .update({ ordem })
      .eq("captacao_id", captacaoId)
      .eq("lista_id", listaId);
    if (error) {
      if (anterior !== undefined) store.setOrdemVinculo(captacaoId, listaId, anterior);
      return false;
    }
    return true;
  }

  const anterior = store.find(captacaoId)?.ordem;
  store.patch(captacaoId, { ordem });
  const { error } = await supabase.from("captacao").update({ ordem }).eq("id", captacaoId);
  if (error) {
    if (anterior !== undefined) store.patch(captacaoId, { ordem: anterior });
    return false;
  }
  return true;
}
