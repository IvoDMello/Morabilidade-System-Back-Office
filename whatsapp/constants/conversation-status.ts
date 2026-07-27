import { SEMANTIC_TONES, type SemanticTone } from "./semantic-colors";

export const CONVERSATION_STATUSES = [
  { value: "aguardando_resposta", label: "Aguardando resposta" },
  { value: "respondida", label: "Respondida" },
  { value: "follow_up_sugerido", label: "Follow-up sugerido" },
  { value: "encerrada", label: "Encerrada" },
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]["value"];

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> =
  Object.fromEntries(
    CONVERSATION_STATUSES.map((s) => [s.value, s.label]),
  ) as Record<ConversationStatus, string>;

// Status da conversa — paleta semântica única.
export const CONVERSATION_STATUS_COLORS: Record<ConversationStatus, string> = {
  aguardando_resposta: SEMANTIC_TONES.waiting,
  respondida: SEMANTIC_TONES.success,
  follow_up_sugerido: SEMANTIC_TONES.attention,
  encerrada: SEMANTIC_TONES.neutral,
};

/** Urgência da espera por uma resposta minha: até 2h neutro, 2h-24h âmbar, acima de 24h vermelho. */
export function urgencyToneForWait(hoursWaiting: number): SemanticTone {
  if (hoursWaiting >= 24) return "danger";
  if (hoursWaiting >= 2) return "waiting";
  return "neutral";
}
