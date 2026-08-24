/**
 * Ordenação da listagem de Imóveis.
 *
 * Na gaveta existe uma escolha só: ordenar por VALOR, crescente ou
 * decrescente. Nenhuma das duas marcada é o estado normal da tela — a lista sai
 * como sempre saiu, mais recente primeiro.
 *
 * A API expressa ordem como um valor único (`preco_asc`, `dormitorios_asc`…);
 * este módulo é a tradução, e o lugar onde mora a precedência entre as duas
 * coisas que podem querer mandar na ordem.
 */

/** "" = sem ordenação por valor (a tela usa o padrão da API). */
export type DirecaoValor = "" | "asc" | "desc";

export interface EstadoOrdenacao {
  /** O que os botões da gaveta dizem. */
  direcaoValor: DirecaoValor;
  /** True quando o chip de quartos está em "4+". */
  quartosAberto: boolean;
}

/**
 * Param `ordenar` para a API.
 *
 * ── A precedência ─────────────────────────────────────────────────────────
 * Duas coisas podem querer ordenar: os botões de valor e o chip "4+" (que
 * organiza por número de quartos, senão "quatro ou mais" devolve os de quatro
 * misturados com os de sete). Escolha explícita ganha: se alguém apertou
 * crescente ou decrescente, é isso que vale, e o "4+" volta a ser só filtro.
 * Sem escolha nenhuma, o "4+" ordena.
 *
 * Sem nada disso, devolve `{}` — mandar o padrão não mudaria o resultado e só
 * sujaria a query; param ausente é o que deixa claro, olhando a requisição,
 * que ninguém mexeu na ordem.
 */
export function paramsDeOrdenacao({
  direcaoValor,
  quartosAberto,
}: EstadoOrdenacao): Record<string, string> {
  if (direcaoValor === "asc") return { ordenar: "preco_asc" };
  if (direcaoValor === "desc") return { ordenar: "preco_desc" };
  if (quartosAberto) return { ordenar: "dormitorios_asc" };
  return {};
}

/**
 * O que a tela diz embaixo dos botões. "Crescente" sozinho não informa se o
 * caro vem antes ou depois, e conferir isso exigiria rodar a busca e olhar.
 */
export function ajudaDaOrdem({ direcaoValor, quartosAberto }: EstadoOrdenacao): string {
  if (direcaoValor === "asc") return "Menor valor primeiro";
  if (direcaoValor === "desc") return "Maior valor primeiro";
  if (quartosAberto) return "Do menor para o maior número de quartos";
  return "Mais recentes primeiro";
}
