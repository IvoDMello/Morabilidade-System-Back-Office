import type { Captacao, Criterios, Situacao } from "@/types";
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

/** Contexto que o filtro não consegue derivar do cartão sozinho. */
export interface ContextoFiltro {
  /** Ids das listas de cada captação. */
  listasPorCaptacao: Map<string, string[]>;
}

/** Uma captação está "parada" quando ninguém a toca há dias. */
export function estaParada(c: Captacao): boolean {
  // Gaveta e Seleção Especial são paradas por definição: quem engavetou sabe
  // disso, então não entram no alerta.
  if (c.status === "gaveta" || c.status === "selecao_especial") return false;
  return diasParado(c.atualizado_em) >= DIAS_PARADO;
}

/** Data de entrada usada pelo filtro de período: quando a captação foi decidida, senão quando nasceu. */
function entradaEm(c: Captacao): string {
  return c.decisao_em ?? c.criado_em;
}

/** A captação satisfaz um dos recortes de situação marcados? */
function casaSituacao(c: Captacao, s: Situacao): boolean {
  const temVisita = c.visita_em != null || c.visita_data != null;
  const temGravacao = c.gravacao_em != null || c.gravacao_data != null;
  switch (s) {
    case "sem_agendamento":
      return !temVisita && !temGravacao;
    case "visita_agendada":
      return temVisita;
    case "gravacao_agendada":
      return temGravacao;
    case "gravada":
      return c.gravacao_concluida;
    case "nao_gravada":
      return !c.gravacao_concluida;
    case "no_sistema":
      return c.imovel_codigo != null;
    case "paradas":
      return estaParada(c);
  }
}

function algumCriterioAtivo(crit: Criterios): boolean {
  return (
    crit.listas.length > 0 ||
    crit.bairros.length > 0 ||
    crit.situacoes.length > 0 ||
    crit.valorMin != null ||
    crit.valorMax != null ||
    crit.metragemMin != null ||
    crit.metragemMax != null ||
    crit.quartosMin != null ||
    crit.suitesMin != null ||
    crit.vagasMin != null ||
    crit.entradaDe != null ||
    crit.entradaAte != null
  );
}

/**
 * Aplica os filtros estruturados do painel. Critérios vazios não restringem
 * nada; dentro de um mesmo campo de seleção múltipla vale OU (Ipanema OU
 * Leblon), entre campos diferentes vale E.
 *
 * Valores nulos no cartão nunca "passam" por um mínimo/máximo: quem não
 * informou o valor de venda não aparece num filtro por faixa de preço.
 */
export function filtrarPorCriterios(
  cards: Captacao[],
  crit: Criterios,
  ctx?: ContextoFiltro
): Captacao[] {
  if (!algumCriterioAtivo(crit)) return cards;

  return cards.filter((c) => {
    if (crit.listas.length > 0) {
      const doCartao = ctx?.listasPorCaptacao.get(c.id) ?? [];
      if (!crit.listas.some((id) => doCartao.includes(id))) return false;
    }
    if (crit.bairros.length > 0 && (c.bairro == null || !crit.bairros.includes(c.bairro))) return false;

    if (crit.valorMin != null && (c.valor_venda == null || c.valor_venda < crit.valorMin)) return false;
    if (crit.valorMax != null && (c.valor_venda == null || c.valor_venda > crit.valorMax)) return false;
    if (crit.metragemMin != null && (c.metragem == null || c.metragem < crit.metragemMin)) return false;
    if (crit.metragemMax != null && (c.metragem == null || c.metragem > crit.metragemMax)) return false;
    if (crit.quartosMin != null && (c.quartos == null || c.quartos < crit.quartosMin)) return false;
    if (crit.suitesMin != null && (c.suites == null || c.suites < crit.suitesMin)) return false;
    if (crit.vagasMin != null && (c.vagas == null || c.vagas < crit.vagasMin)) return false;

    if (crit.entradaDe != null && entradaEm(c) < crit.entradaDe) return false;
    // `entradaAte` é um dia inteiro: compara contra o fim dele.
    if (crit.entradaAte != null && entradaEm(c) > `${crit.entradaAte}T23:59:59.999Z`) return false;

    if (crit.situacoes.length > 0 && !crit.situacoes.some((s) => casaSituacao(c, s))) return false;

    return true;
  });
}

/** Bairros presentes na base, ordenados, para alimentar o filtro. */
export function bairrosDisponiveis(cards: Captacao[]): string[] {
  const set = new Set<string>();
  for (const c of cards) if (c.bairro) set.add(c.bairro);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
