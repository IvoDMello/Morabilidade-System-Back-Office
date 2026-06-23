import type { Captacao, Ordenacao } from "@/types";

function tempo(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/** Valores nulos vão sempre para o fim, independente da direção. */
function comparaValor(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * dir;
}

/**
 * Ordena uma coluna conforme o critério escolhido, sem mutar a lista.
 * "manual" preserva a ordem já vinda do store (campo `ordem`).
 */
export function ordenarCaptacoes(cards: Captacao[], ord: Ordenacao): Captacao[] {
  if (ord === "manual") return cards;
  const arr = [...cards];
  switch (ord) {
    case "recentes":
      return arr.sort((a, b) => tempo(b.criado_em) - tempo(a.criado_em));
    case "antigas":
      return arr.sort((a, b) => tempo(a.criado_em) - tempo(b.criado_em));
    case "valor_desc":
      return arr.sort((a, b) => comparaValor(a.valor_venda, b.valor_venda, -1));
    case "valor_asc":
      return arr.sort((a, b) => comparaValor(a.valor_venda, b.valor_venda, 1));
    case "paradas":
      // Mais parada primeiro = atualização mais antiga primeiro.
      return arr.sort((a, b) => tempo(a.atualizado_em) - tempo(b.atualizado_em));
    default:
      return arr;
  }
}
