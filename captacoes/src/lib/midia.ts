import type { Midia } from "@/types";

/** Quantas fotos e vídeos uma captação tem — para o selo no card recolhido. */
export interface MidiaResumo {
  fotos: number;
  videos: number;
}

export const MIDIA_VAZIA: MidiaResumo = { fotos: 0, videos: 0 };

/**
 * Conta mídia por captação. O card da lista mostra a capa, mas a capa sozinha
 * não diz se existe UMA foto ou quinze — e "tem material?" é a pergunta que
 * decide se dá para avaliar o imóvel sem abrir.
 */
export function contarMidia(midias: Pick<Midia, "captacao_id" | "tipo">[]): Record<string, MidiaResumo> {
  const out: Record<string, MidiaResumo> = {};
  for (const m of midias) {
    const atual = (out[m.captacao_id] ??= { fotos: 0, videos: 0 });
    if (m.tipo === "video") atual.videos++;
    else atual.fotos++;
  }
  return out;
}

/** Rótulo curto do selo: "8 fotos", "8 fotos · 1 vídeo", "1 vídeo". */
export function rotuloMidia(r: MidiaResumo): string | null {
  const partes: string[] = [];
  if (r.fotos > 0) partes.push(`${r.fotos} ${r.fotos === 1 ? "foto" : "fotos"}`);
  if (r.videos > 0) partes.push(`${r.videos} ${r.videos === 1 ? "vídeo" : "vídeos"}`);
  return partes.length ? partes.join(" · ") : null;
}
