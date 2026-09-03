import { orderBetween } from "@/lib/order";
import type { Captacao, PautaItem } from "@/types";

/** Ordem para inserir no fim de uma lista já ordenada por `ordem`. */
export function ordemNoFim(lista: { ordem: number }[]): number {
  return orderBetween(lista[lista.length - 1]?.ordem ?? null, null);
}

/**
 * Ordem para colocar um elemento na posição `index` de uma lista já ordenada
 * (a lista NÃO deve conter o elemento que está sendo movido). `index` igual ao
 * tamanho da lista = fim.
 */
export function ordemNaPosicao(lista: { ordem: number }[], index: number): number {
  const antes = index > 0 ? lista[index - 1]?.ordem ?? null : null;
  const depois = lista[index]?.ordem ?? null;
  return orderBetween(antes, depois);
}

/** Progresso de uma pauta para o cabeçalho do cartão ("3/7"). */
export function progresso(itens: PautaItem[]): { feitos: number; total: number } {
  return { feitos: itens.filter((i) => i.concluido).length, total: itens.length };
}

/**
 * Texto padrão do item criado ao arrastar uma captação para a pauta.
 * Endereço + unidade, que é como o cartão se identifica no quadro.
 */
export function textoDaCaptacao(c: Pick<Captacao, "endereco" | "unidade" | "bairro">): string {
  const partes = [c.endereco.trim()];
  if (c.unidade?.trim()) partes.push(`ap ${c.unidade.trim()}`);
  if (c.bairro?.trim()) partes.push(c.bairro.trim());
  return partes.join(" · ");
}

/**
 * Dias até uma data 'YYYY-MM-DD', comparando meia-noite local com meia-noite
 * local (0 = hoje, negativo = já passou). O "T00:00:00" é essencial: sem ele
 * o Date interpreta a string como UTC e o Brasil cai no dia anterior.
 */
export function diasAteData(ymd: string, agora: Date = new Date()): number {
  const alvo = new Date(`${ymd}T00:00:00`).getTime();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  return Math.round((alvo - hoje) / 86400000);
}

/** Rótulo curto da data prevista da pauta ("hoje", "em 3d", "atrasada 2d"). */
export function rotuloData(ymd: string, agora: Date = new Date()): string {
  const d = diasAteData(ymd, agora);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d > 1) return `em ${d}d`;
  return d === -1 ? "atrasada 1d" : `atrasada ${-d}d`;
}

/**
 * Ordem para mover o elemento `de` uma posição para cima (-1) ou para baixo
 * (+1). Devolve null quando já está na ponta. É o que os botões ↑/↓ do mobile
 * usam — arrastar não funciona bem no toque dentro de uma lista rolável.
 */
export function ordemAoMover(
  lista: { ordem: number }[],
  de: number,
  delta: 1 | -1
): number | null {
  const alvo = de + delta;
  if (de < 0 || de >= lista.length || alvo < 0 || alvo >= lista.length) return null;
  return ordemNaPosicao(
    lista.filter((_, i) => i !== de),
    alvo
  );
}
