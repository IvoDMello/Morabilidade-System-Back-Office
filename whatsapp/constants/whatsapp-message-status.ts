export const WHATSAPP_MESSAGE_STATUSES = [
  { value: "received", label: "Recebida" },
  { value: "sent", label: "Enviada" },
  { value: "delivered", label: "Entregue" },
  { value: "read", label: "Lida" },
  { value: "failed", label: "Falhou" },
] as const;

export type WhatsAppMessageStatus = (typeof WHATSAPP_MESSAGE_STATUSES)[number]["value"];

export const WHATSAPP_MESSAGE_STATUS_LABELS: Record<WhatsAppMessageStatus, string> =
  Object.fromEntries(
    WHATSAPP_MESSAGE_STATUSES.map((s) => [s.value, s.label]),
  ) as Record<WhatsAppMessageStatus, string>;
