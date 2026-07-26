import { SEMANTIC_TONES } from "./semantic-colors";

// Matiz de cada status — usada nas barras do dashboard para a cor da barra
// ser a mesma do texto do badge daquele status. Tokens de tema (claro/escuro),
// então só servem para contextos CSS (style/background), não para canvas.
export const CONTACT_STATUS_SOLID_BY_VALUE = {
  novo: "var(--ink-mid)",
  em_atendimento: "var(--lilac)",
  aguardando_retorno: "var(--gold)",
  visita_marcada: "var(--sky)",
  documentacao: "var(--ember)",
  finalizado: "var(--jade-soft)",
  perdido: "var(--fade)",
} as const;

export const CONTACT_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "em_atendimento", label: "Em atendimento" },
  { value: "aguardando_retorno", label: "Aguardando retorno" },
  { value: "visita_marcada", label: "Visita marcada" },
  { value: "documentacao", label: "Documentação" },
  { value: "finalizado", label: "Finalizado" },
  { value: "perdido", label: "Perdido" },
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number]["value"];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> =
  Object.fromEntries(
    CONTACT_STATUSES.map((s) => [s.value, s.label]),
  ) as Record<ContactStatus, string>;

// Cores dos badges de status — paleta semântica única. Estágios adjacentes do
// funil nunca compartilham cor; "documentação" usa o tom de urgência (salmão)
// e "perdido" o tom apagado, como no redesign escuro.
export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  novo: SEMANTIC_TONES.neutral,
  em_atendimento: SEMANTIC_TONES.progress,
  aguardando_retorno: SEMANTIC_TONES.waiting,
  visita_marcada: SEMANTIC_TONES.info,
  documentacao: SEMANTIC_TONES.danger,
  finalizado: SEMANTIC_TONES.success,
  perdido: SEMANTIC_TONES.faded,
};
