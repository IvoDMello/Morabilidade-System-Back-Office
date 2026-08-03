/**
 * Preço por token, para transformar o livro-razão em reais gastos.
 *
 * Sem isto o `agent_runs` guarda números sem significado: ninguém decide nada
 * olhando "1.240.000 tokens de entrada". A pergunta que a operação faz é
 * "quanto a IA custou ontem", e ela precisa de uma tabela de preços.
 *
 * Os valores são em **dólares por milhão de tokens**, como a Anthropic publica.
 * Ficam aqui em código, versionados, e não no banco: preço é fato externo que
 * muda por anúncio, e um número desses no banco vira legado silencioso que
 * ninguém sabe de quando é.
 */

export interface PrecoModelo {
  /** USD por milhão de tokens de entrada. */
  entrada: number;
  /** USD por milhão de tokens de saída. */
  saida: number;
}

/**
 * Tabela consultada em 2026-08-03. Só os modelos que este app usa.
 *
 * A diferença entre eles é o argumento central da escolha de modelo aqui:
 * Haiku custa 1/3 de Sonnet na entrada e na saída. Numa triagem que só extrai
 * dado estruturado da conversa, essa é a economia mais barata que existe —
 * não exige mudar nada além de uma variável de ambiente.
 */
export const PRECOS: Record<string, PrecoModelo> = {
  "claude-opus-5": { entrada: 5, saida: 25 },
  "claude-sonnet-5": { entrada: 3, saida: 15 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
};

/** Multiplicadores de cache da Anthropic, relativos ao preço de entrada. */
const CACHE_LEITURA = 0.1;
const CACHE_ESCRITA = 1.25;

export interface ConsumoTokens {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Custo estimado de uma chamada, em dólares.
 *
 * "Estimado" é literal: modelo desconhecido na tabela devolve `null` em vez de
 * chutar. Um custo inventado é pior que custo nenhum — alguém decidiria com
 * base nele. A fonte de verdade continua sendo a fatura da Anthropic.
 */
export function estimarCustoUSD(modelo: string, uso: ConsumoTokens): number | null {
  const preco = PRECOS[modelo];
  if (!preco) return null;

  const porMilhao = (tokens: number, precoUnit: number) => (tokens / 1_000_000) * precoUnit;

  return (
    porMilhao(uso.inputTokens, preco.entrada) +
    porMilhao(uso.outputTokens, preco.saida) +
    porMilhao(uso.cacheCreationTokens ?? 0, preco.entrada * CACHE_ESCRITA) +
    porMilhao(uso.cacheReadTokens ?? 0, preco.entrada * CACHE_LEITURA)
  );
}

/** Formata um custo em USD para leitura humana (4 casas: as chamadas são baratas
 * individualmente, e arredondar para centavos mostraria só zeros). */
export function formatarCustoUSD(usd: number | null): string {
  if (usd === null) return "—";
  return `US$ ${usd.toFixed(4)}`;
}
