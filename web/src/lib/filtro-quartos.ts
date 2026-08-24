/**
 * Filtro de quartos da tela de Imóveis: 1, 2, 3, 4+.
 *
 * Vive fora da página porque arquivo de rota do App Router só pode exportar o
 * componente e os campos que o Next reconhece — qualquer export a mais vira
 * erro de build. E porque esta é a única regra do filtro que dá para errar em
 * silêncio: mandar só `dormitorios_min` faria "2 quartos" trazer também as
 * coberturas de cinco, resultado errado que a tela não tem como denunciar.
 */

/** Opções oferecidas na gaveta, na ordem em que aparecem. */
export const OPCOES_QUARTOS = ["1", "2", "3", "4"] as const;

/**
 * O único chip sem teto. Os três primeiros são contagem exata — quem escolhe
 * "2" não quer ver cobertura de cinco — e acima de quatro a diferença deixa de
 * organizar a busca, então "4+" é aberto.
 */
export const QUARTOS_ABERTO = "4";

/**
 * Traduz o chip escolhido para os params de filtro que a API espera.
 *
 * Só filtro — a ordenação saiu daqui quando a gaveta ganhou controle próprio de
 * ordem. Enquanto os dois mandavam `ordenar`, havia duas fontes disputando o
 * mesmo parâmetro, e quem escolhesse "4+" e depois "ordenar por preço" ficaria
 * na mão de quem escrevesse por último. Hoje o chip "4+" ajusta o controle de
 * ordenação (ver a página), que continua sendo o único dono do `ordenar` — e o
 * usuário vê na tela o que foi ajustado, em vez de a ordem mudar sozinha.
 */
export function paramsDeQuartos(quartos: string): Record<string, string> {
  if (!quartos) return {};
  return quartos === QUARTOS_ABERTO
    ? { dormitorios_min: quartos }
    : { dormitorios_min: quartos, dormitorios_max: quartos };
}
