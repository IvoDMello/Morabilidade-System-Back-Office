import { createClient } from "@/lib/supabase/client";
import type { OpinioesResumo } from "@/types";

/** Busca os contadores de opiniões (total/não lidas) de todas as captações. */
export async function fetchOpinioesResumo(): Promise<Record<string, OpinioesResumo>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("opinioes_resumo");
  if (error || !data) return {};
  const out: Record<string, OpinioesResumo> = {};
  for (const r of data as { captacao_id: string; total: number; nao_lidas: number }[]) {
    out[r.captacao_id] = { total: Number(r.total), naoLidas: Number(r.nao_lidas) };
  }
  return out;
}

/** Iniciais (até 2 letras) de um nome para o avatar. */
export function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Cor estável por pessoa (hash simples do nome sobre a paleta do app). */
const CORES_AVATAR = [
  { bg: "#f4f1d4", fg: "#857727" },
  { bg: "#e5efe8", fg: "#2f6b46" },
  { bg: "#e3edf1", fg: "#2f5b6f" },
  { bg: "#f7ecd9", fg: "#8f6320" },
  { bg: "#f4e8e8", fg: "#8a4444" },
  { bg: "#e9eaf0", fg: "#565b72" },
];

export function corAvatar(nome: string): { bg: string; fg: string } {
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.codePointAt(0)!) % 997;
  return CORES_AVATAR[h % CORES_AVATAR.length];
}
