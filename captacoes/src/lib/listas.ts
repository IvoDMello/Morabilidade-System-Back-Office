import type { CaptacaoLista, CorLista, Lista } from "@/types";

/**
 * Estilo de cada cor de lista: ponto, fundo e texto do chip.
 * As seis cores do app de atendimento, reinterpretadas para o olive/gold
 * daqui — `cinza`, `rosa` e `ambar` reusam os hexes que Gaveta, Seleção
 * Especial e Novas já tinham no quadro v1, para a virada não trocar as cores
 * que a equipe já reconhece.
 */
export interface CorStyle {
  label: string;
  dot: string;
  bg: string;
  fg: string;
}

export const COR_LISTA: Record<CorLista, CorStyle> = {
  cinza:   { label: "Cinza",   dot: "#8a8fa8", bg: "#e9eaf0", fg: "#565b72" },
  azul:    { label: "Azul",    dot: "#5887a0", bg: "#e3edf1", fg: "#2f5b6f" },
  verde:   { label: "Verde",   dot: "#5a9a6e", bg: "#e5efe8", fg: "#2f6b46" },
  ambar:   { label: "Âmbar",   dot: "#c5b54a", bg: "#f4f1d4", fg: "#857727" },
  rosa:    { label: "Rosa",    dot: "#a4739a", bg: "#f2e7ef", fg: "#6f3f63" },
  violeta: { label: "Violeta", dot: "#7d7aa8", bg: "#e9e9f2", fg: "#4c4a72" },
};

/** Fallback seguro: cor desconhecida vinda do banco não quebra a renderização. */
export function corDaLista(lista: Pick<Lista, "cor">): CorStyle {
  return COR_LISTA[lista.cor] ?? COR_LISTA.cinza;
}

/**
 * Índice captação → listas, para não varrer o array de vínculos por cartão.
 * As listas de cada captação saem na ordem de exibição das listas.
 */
export function indexarListas(vinculos: CaptacaoLista[], listas: Lista[]): Map<string, Lista[]> {
  const porId = new Map(listas.map((l) => [l.id, l]));
  const posicao = new Map(listas.map((l, i) => [l.id, i]));
  const out = new Map<string, Lista[]>();

  for (const v of vinculos) {
    const lista = porId.get(v.lista_id);
    if (!lista) continue;
    const atual = out.get(v.captacao_id);
    if (atual) atual.push(lista);
    else out.set(v.captacao_id, [lista]);
  }

  for (const arr of out.values()) {
    arr.sort((a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0));
  }
  return out;
}

/** Ids das captações de uma lista. */
export function captacoesDaLista(vinculos: CaptacaoLista[], listaId: string): Set<string> {
  const out = new Set<string>();
  for (const v of vinculos) if (v.lista_id === listaId) out.add(v.captacao_id);
  return out;
}

/**
 * Ordem da captação dentro de uma lista (a sequência de gravação). Sem
 * vínculo, vai para o fim — nunca para o topo por acidente.
 */
export function ordemNaLista(vinculos: CaptacaoLista[], listaId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of vinculos) if (v.lista_id === listaId) out.set(v.captacao_id, v.ordem);
  return out;
}

/** Barra de listas: as permanentes primeiro, o resto atrás de "ver todas". */
export function separarListas(listas: Lista[]): { fixas: Lista[]; migracao: Lista[] } {
  const ordenadas = [...listas].sort((a, b) => a.ordem - b.ordem);
  return {
    fixas: ordenadas.filter((l) => l.permanente),
    migracao: ordenadas.filter((l) => !l.permanente),
  };
}
