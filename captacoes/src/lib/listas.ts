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

/** Quanto uma lista pesa na aba aberta, e quanto dela está fora dela. */
export interface ContagemLista {
  /** Captações da lista que a aba atual mostra — é o que a pill filtra. */
  aqui: number;
  /** Captações vivas da lista em outras etapas — explicam um `aqui` zerado. */
  fora: number;
}

/**
 * Conta cada lista sob dois pontos de vista.
 *
 * A barra de listas mora na aba Aprovadas, mas etiquetar acontece também em
 * Decidir, pelo menu ⋯ do cartão. Contando só o que a aba mostra, uma lista
 * montada a partir de Decidir aparecia como "0" — parecia que as etiquetas
 * não tinham pegado. `fora` é o que devolve sentido a esse zero.
 *
 * `idsVivos` existe para não contar captação excluída: o vínculo em
 * `captacao_lista` só some no cascade de uma exclusão de verdade, e a
 * lixeira é exclusão lógica (`excluido_em`).
 */
export function contarPorLista(
  vinculos: CaptacaoLista[],
  idsAqui: Set<string>,
  idsVivos: Set<string>
): Map<string, ContagemLista> {
  const out = new Map<string, ContagemLista>();
  for (const v of vinculos) {
    if (!idsVivos.has(v.captacao_id)) continue;
    const atual = out.get(v.lista_id) ?? { aqui: 0, fora: 0 };
    if (idsAqui.has(v.captacao_id)) atual.aqui += 1;
    else atual.fora += 1;
    out.set(v.lista_id, atual);
  }
  return out;
}

/**
 * Uma lista feita por alguém da equipe, e não herdada da virada v2.
 *
 * As oito listas que a migration 0021 criou a partir das colunas do Kanban
 * antigo nasceram sem autor; toda lista criada pela tela grava `criado_por`.
 * É a diferença que permite recolher as herdadas sem nunca esconder uma
 * lista que alguém criou de propósito.
 */
function feitaPorAlguem(l: Lista): boolean {
  return l.criado_por != null;
}

/**
 * Quais pills a barra de listas desenha, e quantas ficam recolhidas.
 *
 * As permanentes aparecem sempre. Das demais, o estado recolhido esconde as
 * HERDADAS que não têm captação na aba — as oito da virada não podem
 * empurrar Prioridade e Gaveta para fora da tela.
 *
 * Três coisas nunca somem, e cada uma conserta um beco sem saída real:
 *
 * 1. A lista que alguém CRIOU, mesmo com zero captações aqui. Ela nasce
 *    vazia, e etiquetar por Decidir não muda o `aqui`: escondendo-a, a
 *    pessoa criava uma lista, usava, e não achava mais.
 * 2. A lista ATIVA. Criar já deixa ativa, e sem a pill a tela ficava
 *    filtrada por uma lista sem pill nenhuma — nem a dela, nem "Todas".
 * 3. Com "ver todas" ligado, todas — a pill é o único caminho para
 *    renomear ou apagar, e uma lista inalcançável continuava ocupando o
 *    nome no índice único: recriá-la falhava sem que desse para ver a culpada.
 */
export function pillsDaBarra(
  listas: Lista[],
  contagem: Map<string, ContagemLista>,
  listaAtiva: string | null,
  verTodas: boolean
): { mostradas: Lista[]; ocultas: number } {
  const { fixas, migracao } = separarListas(listas);
  const extras = migracao.filter(
    (l) =>
      verTodas ||
      l.id === listaAtiva ||
      feitaPorAlguem(l) ||
      (contagem.get(l.id)?.aqui ?? 0) > 0
  );
  return { mostradas: [...fixas, ...extras], ocultas: migracao.length - extras.length };
}

/** Barra de listas: as permanentes primeiro, o resto atrás de "ver todas". */
export function separarListas(listas: Lista[]): { fixas: Lista[]; migracao: Lista[] } {
  const ordenadas = [...listas].sort((a, b) => a.ordem - b.ordem);
  return {
    fixas: ordenadas.filter((l) => l.permanente),
    migracao: ordenadas.filter((l) => !l.permanente),
  };
}
