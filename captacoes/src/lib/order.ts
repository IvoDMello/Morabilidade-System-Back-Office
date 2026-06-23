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
