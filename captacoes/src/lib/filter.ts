import type { Captacao, Criterios } from "@/types";
import { diasParado } from "./format";

/** Dias sem atualização a partir dos quais consideramos uma captação "parada". */
export const DIAS_PARADO = 3;

/**
 * Filtra captações por um termo de busca (case-insensitive) contra
 * endereço, proprietário, WhatsApp, tipo de portaria e observações.
 * Termo vazio retorna a lista inteira.
 */
export function filtrarCaptacoes(cards: Captacao[], termo: string): Captacao[] {
  const t = termo.trim().toLowerCase();
  if (!t) return cards;
  return cards.filter((c) =>
    [c.endereco, c.proprietario_nome, c.whatsapp, c.tipo_portaria, c.observacoes]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(t))
  );
}

/**
 * Aplica os filtros estruturados (faixa de valor, quartos mínimos e
 * "somente paradas"). Critérios nulos/desligados não restringem nada.
 */
export function filtrarPorCriterios(cards: Captacao[], crit: Criterios): Captacao[] {
  const { valorMin, valorMax, quartosMin, soParadas } = crit;
  if (valorMin == null && valorMax == null && quartosMin == null && !soParadas) return cards;
  return cards.filter((c) => {
    if (valorMin != null && (c.valor_venda == null || c.valor_venda < valorMin)) return false;
    if (valorMax != null && (c.valor_venda == null || c.valor_venda > valorMax)) return false;
    if (quartosMin != null && (c.quartos == null || c.quartos < quartosMin)) return false;
    if (soParadas && diasParado(c.atualizado_em) < DIAS_PARADO) return false;
    return true;
  });
}
