"use client";

import { createClient } from "@/lib/supabase/client";
import type { Pauta, PautaItem } from "@/types";

/**
 * Escritas da raia "Pauta de gravação". Cada função devolve a linha gravada
 * (ou null em erro) para quem chamou decidir entre confirmar o otimista ou
 * fazer rollback — a UI da pauta é sempre otimista.
 */

async function uid(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function criarPauta(
  dados: { titulo: string; descricao: string | null; data_alvo: string | null },
  ordem: number
): Promise<Pauta | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pauta")
    .insert({ ...dados, ordem, criado_por: await uid() })
    .select()
    .single();
  return error ? null : (data as Pauta);
}

export async function atualizarPauta(id: string, patch: Partial<Pauta>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("pauta").update(patch).eq("id", id);
  return !error;
}

/** Soft-delete, igual à captação: some do quadro mas fica no histórico. */
export async function excluirPauta(id: string): Promise<boolean> {
  return atualizarPauta(id, { excluido_em: new Date().toISOString() });
}

export async function criarItem(
  dados: { pauta_id: string; texto: string; captacao_id: string | null },
  ordem: number
): Promise<PautaItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pauta_item")
    .insert({ ...dados, ordem, criado_por: await uid() })
    .select()
    .single();
  return error ? null : (data as PautaItem);
}

export async function atualizarItem(id: string, patch: Partial<PautaItem>): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("pauta_item").update(patch).eq("id", id);
  return !error;
}

/** Item não tem soft-delete: é uma linha de recado, sai de vez. */
export async function excluirItem(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("pauta_item").delete().eq("id", id);
  return !error;
}

/** Recarrega a raia inteira (usado quando o realtime cai e volta). */
export async function carregarPauta(): Promise<{ pautas: Pauta[]; itens: PautaItem[] }> {
  const supabase = createClient();
  const [{ data: pautas }, { data: itens }] = await Promise.all([
    supabase.from("pauta").select("*").is("excluido_em", null).order("ordem"),
    supabase.from("pauta_item").select("*").order("ordem"),
  ]);
  return { pautas: (pautas ?? []) as Pauta[], itens: (itens ?? []) as PautaItem[] };
}
