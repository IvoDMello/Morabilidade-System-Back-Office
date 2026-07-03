import { STATUS_LABEL, type Status } from "@/types";

/**
 * Estilo visual por status (handoff do redesign de Captações).
 * `short` = rótulo curto do badge nos cards; `label` (de STATUS_LABEL) = rótulo
 * completo no detalhe. `dot`/`bg`/`fg` são hexes finais do design.
 */
export interface StatusStyle {
  label: string;
  short: string;
  dot: string;
  bg: string;
  fg: string;
}

export const STATUS_STYLE: Record<Status, StatusStyle> = {
  aguardando_informacoes: { label: STATUS_LABEL.aguardando_informacoes, short: "Aguardando info", dot: "#b0b2a8", bg: "#ebece7", fg: "#5f6157" },
  novas: { label: STATUS_LABEL.novas, short: "Novas", dot: "#c5b54a", bg: "#f4f1d4", fg: "#857727" },
  em_decisao: { label: STATUS_LABEL.em_decisao, short: "Em decisão", dot: "#d49a48", bg: "#f7ecd9", fg: "#8f6320" },
  pendente_agendar_visita: { label: STATUS_LABEL.pendente_agendar_visita, short: "Agendar visita", dot: "#5a9a6e", bg: "#e5efe8", fg: "#2f6b46" },
  pendente_agendar_gravacao: { label: STATUS_LABEL.pendente_agendar_gravacao, short: "Agendar gravação", dot: "#5887a0", bg: "#e3edf1", fg: "#2f5b6f" },
  pendente_negativa: { label: STATUS_LABEL.pendente_negativa, short: "Pend. negativa", dot: "#c98a8a", bg: "#f4e8e8", fg: "#8a4444" },
  negativada: { label: STATUS_LABEL.negativada, short: "Negativada", dot: "#a85a5a", bg: "#f0e2e2", fg: "#7a3434" },
  gaveta: { label: STATUS_LABEL.gaveta, short: "Gaveta", dot: "#8a8fa8", bg: "#e9eaf0", fg: "#565b72" },
};

/** Ordem das pills/colunas do quadro mobile (handoff). */
export const PILL_ORDER: Status[] = [
  "aguardando_informacoes",
  "novas",
  "em_decisao",
  "pendente_agendar_visita",
  "pendente_agendar_gravacao",
  "pendente_negativa",
  "negativada",
  "gaveta",
];
