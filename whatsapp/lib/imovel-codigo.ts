/**
 * Reconhecimento do código de imóvel em texto livre (ex.: "MB-00033").
 *
 * Dois consumidores com riscos bem diferentes:
 *  - o título de lembrete ("Visita — MB-00033"), que **nós** escrevemos;
 *  - a mensagem do cliente, que ninguém controla.
 *
 * Por isso a regra aqui só faz o reconhecimento sintático. Quem lê mensagem de
 * cliente confirma o código no catálogo antes de agir (`fetchImovelByCodigo`
 * devolve null para código inexistente) — é essa consulta, e não o regex, que
 * impede um "CEP-01234" de virar vínculo de imóvel.
 */

/** Prefixo de 2 a 4 letras + hífen + 3 a 6 dígitos. */
const PADRAO_CODIGO = /\b([A-Z]{2,4}-\d{3,6})\b/;

/** Primeiro código encontrado no texto, em caixa alta. Null se não houver. */
export function extrairCodigoImovel(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const match = PADRAO_CODIGO.exec(texto.toUpperCase());
  return match ? match[1] : null;
}

/**
 * O botão de WhatsApp do site público injeta o código entre asteriscos
 * ("código *MB-00033*"). Reconhecer essa assinatura é o que permite atribuir a
 * origem do lead ao site em vez de ao WhatsApp genérico — a atribuição mais
 * barata que o sistema tem, porque o dado já chega pronto na mensagem.
 */
export function pareceLeadDoSite(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return /c[óo]digo\s*\*?[A-Z]{2,4}-\d{3,6}\*?/i.test(texto);
}
