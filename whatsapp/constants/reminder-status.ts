import { SEMANTIC_TONES } from "./semantic-colors";

export const REMINDER_STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number]["value"];

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> =
  Object.fromEntries(
    REMINDER_STATUSES.map((s) => [s.value, s.label]),
  ) as Record<ReminderStatus, string>;

// Status do lembrete — paleta semântica única.
export const REMINDER_STATUS_COLORS: Record<ReminderStatus, string> = {
  pendente: SEMANTIC_TONES.waiting,
  concluido: SEMANTIC_TONES.success,
  cancelado: SEMANTIC_TONES.neutral,
};
