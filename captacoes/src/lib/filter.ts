import type { Captacao, Criterios } from "@/types";
import { diasParado } from "./format";

/** Dias sem atualização a partir dos quais consideramos uma captação "parada". */
export const DIAS_PARADO = 3;

/** Minúsculas sem acentos, para busca acento-insensível ("Brandão" casa "Brandao"). */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Filtra captações por um termo de busca (case- e acento-insensitive) contra
 * endereço, unidade, bairro, proprietário, WhatsApp, tipo de portaria e observações.
 * Termos numéricos também casam contra os dígitos do WhatsApp (ex.: os
 * 4 últimos do telefone), ignorando máscara/formatação.
 * Termo vazio retorna a lista inteira.
 */
export function filtrarCaptacoes(cards: Captacao[], termo: string): Captacao[] {
  const t = normalizar(termo.trim());
  if (!t) return cards;
  const tDigits = t.replace(/\D/g, "");
  return cards.filter((c) => {
    const textual = [c.endereco, c.unidade, c.bairro, c.proprietario_nome, c.whatsapp, c.tipo_portaria, c.observacoes]
      .filter(Boolean)
      .some((v) => normalizar(v!).includes(t));
    if (textual) return true;
    return tDigits.length >= 2 && !!c.whatsapp && c.whatsapp.replace(/\D/g, "").includes(tDigits);
  });
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
    // Gaveta e Seleção Especial são paradas por definição — não entram no alerta de "somente paradas".
    if (soParadas && (c.status === "gaveta" || c.status === "selecao_especial" || diasParado(c.atualizado_em) < DIAS_PARADO)) return false;
    return true;
  });
}
