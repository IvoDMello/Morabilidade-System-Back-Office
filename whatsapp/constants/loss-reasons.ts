export const LOSS_REASONS = [
  { value: "comprou_concorrente", label: "Comprou com concorrente" },
  { value: "desistiu", label: "Desistiu" },
  { value: "preco_alto", label: "Preço alto" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "imovel_inadequado", label: "Imóvel inadequado" },
  { value: "outro", label: "Outro" },
] as const;

export type LossReason = (typeof LOSS_REASONS)[number]["value"];

export const LOSS_REASON_LABELS: Record<LossReason, string> = Object.fromEntries(
  LOSS_REASONS.map((r) => [r.value, r.label]),
) as Record<LossReason, string>;
