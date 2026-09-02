/**
 * Ordenação da listagem de Imóveis.
 *
 * A gaveta oferece dois critérios — VALOR e METRAGEM — cada um com crescente e
 * decrescente, e os dois podem estar marcados ao mesmo tempo. Nenhum marcado é
 * o estado normal da tela: a lista sai como sempre saiu, mais recente primeiro.
 *
 * ── Por que os dois juntos, e por que uma lista ──────────────────────────────
 * Ordenar por dois números contínuos só faz diferença nos empates do primeiro —
 * e em imóvel isso não é detalhe: preço é redondo, meia dúzia de anúncios a
 * R$ 1.200.000 é rotina, e é ali que "maior metragem antes" separa o que estava
 * embolado por data de cadastro.
 *
 * Daí o estado ser uma lista, e não dois campos soltos: a POSIÇÃO é a
 * hierarquia. O primeiro manda, o segundo desempata. Com dois campos
 * independentes não haveria onde guardar quem veio antes, e a tela teria de
 * inventar um preferido fixo — que é justamente a escolha que o usuário quer
 * fazer.
 */

/** Um critério com direção, do jeito que a API nomeia. */
export type ChaveOrdem = "preco_asc" | "preco_desc" | "metragem_asc" | "metragem_desc";

/** A gaveta inteira: vazia = sem ordenação, primeiro item manda. */
export type OrdemEscolhida = ChaveOrdem[];

/**
 * Os dois grupos de botões, na ordem em que a gaveta os desenha. Fica aqui, e
 * não no componente, para os rótulos da tela e os textos da linha de ajuda
 * saírem da mesma fonte — separados, um dia diriam coisas diferentes sobre a
 * mesma ordenação.
 */
export const CRITERIOS = [
  {
    criterio: "valor",
    titulo: "Valor",
    /** "entre os de mesmo valor" — o gênero muda com o critério. */
    mesmo: "mesmo valor",
    asc: { chave: "preco_asc", rotulo: "Menor valor" },
    desc: { chave: "preco_desc", rotulo: "Maior valor" },
  },
  {
    criterio: "metragem",
    titulo: "Metragem",
    mesmo: "mesma metragem",
    asc: { chave: "metragem_asc", rotulo: "Menor metragem" },
    desc: { chave: "metragem_desc", rotulo: "Maior metragem" },
  },
] as const;

const POR_CHAVE = new Map(
  CRITERIOS.flatMap((c) =>
    [c.asc, c.desc].map((d) => [d.chave as ChaveOrdem, { ...c, rotulo: d.rotulo }] as const),
  ),
);

/** "preco_desc" → "valor". Usado para saber quem disputa com quem. */
export function criterioDe(chave: ChaveOrdem): string {
  return POR_CHAVE.get(chave)!.criterio;
}

/**
 * O que um clique num botão faz com a lista.
 *
 * Três casos, e cada um existe por um motivo:
 *
 * - Botão já aceso → sai da lista. É como os chips de Contrato e Quartos se
 *   comportam; sem isso, uma vez ordenada a lista não haveria como voltar ao
 *   normal sem limpar a gaveta inteira.
 * - Outro botão do MESMO critério aceso → troca no lugar, mantendo a posição.
 *   Trocar de crescente para decrescente é mudar a direção, não recomeçar a
 *   escolha: mandar a chave para o fim da lista rebaixaria o critério principal
 *   a desempate sem que ninguém tenha pedido isso.
 * - Critério novo → entra no fim. Quem foi escolhido antes continua mandando, e
 *   é assim que se decide qual dos dois é o principal — pela ordem do clique,
 *   sem um campo "primário" a mais na tela.
 */
export function alternarOrdem(atual: OrdemEscolhida, chave: ChaveOrdem): OrdemEscolhida {
  if (atual.includes(chave)) return atual.filter((c) => c !== chave);
  const i = atual.findIndex((c) => criterioDe(c) === criterioDe(chave));
  if (i === -1) return [...atual, chave];
  const trocada = [...atual];
  trocada[i] = chave;
  return trocada;
}

export interface EstadoOrdenacao {
  /** Os botões acesos na gaveta, do que manda para o que desempata. */
  ordem: OrdemEscolhida;
  /** True quando o chip de quartos está em "4+". */
  quartosAberto: boolean;
}

/**
 * Param `ordenar` para a API — os critérios separados por vírgula, na ordem em
 * que valem.
 *
 * ── A precedência ─────────────────────────────────────────────────────────
 * Duas coisas podem querer ordenar: os botões da gaveta e o chip "4+" (que
 * organiza por número de quartos, senão "quatro ou mais" devolve os de quatro
 * misturados com os de sete). Escolha explícita ganha: se alguém apertou um
 * botão, é isso que vale, e o "4+" volta a ser só filtro. Sem escolha nenhuma,
 * o "4+" ordena.
 *
 * Sem nada disso, devolve `{}` — mandar o padrão não mudaria o resultado e só
 * sujaria a query; param ausente é o que deixa claro, olhando a requisição,
 * que ninguém mexeu na ordem.
 *
 * `metragem_*`, e não o `area_*` que o site público usa: a metragem do card do
 * back-office é a área útil com a área total de reserva, e é por essa que a
 * lista precisa sair — ver a migration 053 da API.
 */
export function paramsDeOrdenacao({
  ordem,
  quartosAberto,
}: EstadoOrdenacao): Record<string, string> {
  if (ordem.length) return { ordenar: ordem.join(",") };
  if (quartosAberto) return { ordenar: "dormitorios_asc" };
  return {};
}

/**
 * O que a tela diz embaixo dos botões. "Crescente" sozinho não informa se o
 * caro (ou o grande) vem antes ou depois, e conferir isso exigiria rodar a
 * busca e olhar.
 *
 * Com os dois critérios marcados a frase diz "entre os de mesmo valor", porque
 * é literalmente o alcance do segundo: sem os empates do primeiro, ele não
 * muda uma linha da lista, e quem esperasse os dois pesando junto ficaria
 * procurando o efeito na tela.
 */
export function ajudaDaOrdem({ ordem, quartosAberto }: EstadoOrdenacao): string {
  const [principal, desempate] = ordem;
  if (principal && desempate) {
    return (
      `${POR_CHAVE.get(principal)!.rotulo} primeiro; entre os de ` +
      `${POR_CHAVE.get(principal)!.mesmo}, ${POR_CHAVE.get(desempate)!.rotulo.toLowerCase()} antes`
    );
  }
  if (principal) return `${POR_CHAVE.get(principal)!.rotulo} primeiro`;
  if (quartosAberto) return "Do menor para o maior número de quartos";
  return "Mais recentes primeiro";
}
