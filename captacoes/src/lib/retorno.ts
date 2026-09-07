import type { Captacao } from "@/types";

/**
 * Situação do retorno ao proprietário de uma captação reprovada.
 *
 * "sem_prazo" NÃO é atrasado, de propósito: as captações que já estavam em
 * `pendente_negativa` antes da v2 vieram sem prazo (ver migration 0022), e
 * marcá-las como atrasadas abriria o app numa parede vermelha no primeiro
 * dia depois da virada.
 */
export type SituacaoRetorno = "atrasado" | "hoje" | "futuro" | "sem_prazo";

/** Só a etapa Negativadas deve retorno, e só enquanto ninguém avisou. */
export function precisaRetorno(c: Captacao): boolean {
  return c.decisao === "reprovada" && !c.retorno_feito;
}

/**
 * `hoje` entra como "YYYY-MM-DD" para a comparação ser por DIA, sem fuso:
 * um prazo de hoje não vira "atrasado" só porque já passou das 00:00 UTC.
 */
export function situacaoRetorno(c: Captacao, hoje: string): SituacaoRetorno {
  if (!c.retorno_prazo) return "sem_prazo";
  if (c.retorno_prazo < hoje) return "atrasado";
  if (c.retorno_prazo === hoje) return "hoje";
  return "futuro";
}

const PESO: Record<SituacaoRetorno, number> = {
  atrasado: 0,
  hoje: 1,
  futuro: 2,
  sem_prazo: 3,
};

/**
 * Fila de retornos: atrasados primeiro (o mais vencido no topo), depois os de
 * hoje, depois os futuros por prazo, e por último os sem prazo — que ficam
 * visíveis mas não gritam.
 */
export function ordenarRetornos(cards: Captacao[], hoje: string): Captacao[] {
  return [...cards].sort((a, b) => {
    const pa = PESO[situacaoRetorno(a, hoje)];
    const pb = PESO[situacaoRetorno(b, hoje)];
    if (pa !== pb) return pa - pb;
    // Dentro do mesmo grupo, prazo mais antigo primeiro; sem prazo cai para a
    // decisão mais antiga, que é a que espera há mais tempo.
    const ka = a.retorno_prazo ?? a.decisao_em ?? a.criado_em;
    const kb = b.retorno_prazo ?? b.decisao_em ?? b.criado_em;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/**
 * Retornos pendentes, opcionalmente só os de uma pessoa (o filtro "Suas",
 * ligado por padrão na aba). Sem `userId`, devolve os do time inteiro.
 */
export function retornosPendentes(cards: Captacao[], hoje: string, userId?: string): Captacao[] {
  const fila = cards.filter(
    (c) => precisaRetorno(c) && (userId === undefined || c.retorno_responsavel === userId)
  );
  return ordenarRetornos(fila, hoje);
}

/** Quantos retornos atrasados a pessoa tem — é o que acende o contador em vermelho. */
export function contarAtrasados(cards: Captacao[], hoje: string, userId?: string): number {
  return retornosPendentes(cards, hoje, userId).filter(
    (c) => situacaoRetorno(c, hoje) === "atrasado"
  ).length;
}

/**
 * Quem vem pré-selecionado como responsável ao reprovar.
 *
 * Em vez de fixar um nome no código, olha quem de fato carrega esses retornos
 * hoje: a pessoa com mais pendências atribuídas. Sem histórico nenhum, cai em
 * quem está reprovando. Empate resolve pelo id, para a escolha ser estável.
 */
export function responsavelPadrao(cards: Captacao[], userId: string): string {
  const contagem = new Map<string, number>();
  for (const c of cards) {
    if (!precisaRetorno(c) || !c.retorno_responsavel) continue;
    contagem.set(c.retorno_responsavel, (contagem.get(c.retorno_responsavel) ?? 0) + 1);
  }
  let melhor = userId;
  let maior = 0;
  for (const [id, n] of contagem) {
    if (n > maior || (n === maior && id < melhor)) {
      melhor = id;
      maior = n;
    }
  }
  return melhor;
}

/** Negativadas já resolvidas: o histórico, mais recentes primeiro. */
export function historicoNegativadas(cards: Captacao[]): Captacao[] {
  return cards
    .filter((c) => c.decisao === "reprovada" && c.retorno_feito)
    .sort((a, b) => {
      const ka = a.decisao_em ?? a.criado_em;
      const kb = b.decisao_em ?? b.criado_em;
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
}
