/**
 * Fractional indexing para a coluna `ordem` (numeric).
 * Calcula uma posição entre dois vizinhos sem reindexar a coluna inteira.
 *
 * - topo da coluna:    orderBetween(null, primeiro)
 * - fim da coluna:     orderBetween(ultimo, null)
 * - entre dois:        orderBetween(a, b)
 */
const STEP = 1024;

export function orderBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return STEP;
  if (before == null) return after! - STEP;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}

/**
 * Vizinhos do destino ao mover um item da posição `origem` para `destino`
 * numa fila já ordenada. Devolve as ordens entre as quais o item deve cair,
 * prontas para `orderBetween`.
 *
 * A origem sai da lista antes de olhar os vizinhos — senão mover um item uma
 * casa para baixo o compararia consigo mesmo e ele não sairia do lugar.
 */
export function vizinhosDoDestino(
  ordens: number[],
  origem: number,
  destino: number
): { antes: number | null; depois: number | null } {
  const sem = ordens.filter((_, i) => i !== origem);
  return {
    antes: destino > 0 ? (sem[destino - 1] ?? null) : null,
    depois: sem[destino] ?? null,
  };
}
