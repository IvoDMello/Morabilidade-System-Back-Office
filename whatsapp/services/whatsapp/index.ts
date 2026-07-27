import type { WhatsAppProvider } from "./types";
import { mockWhatsAppProvider } from "./providers/mock";
import { cloudApiWhatsAppProvider } from "./providers/cloud-api";

/**
 * Provider ativo. Controlado por WHATSAPP_PROVIDER ("mock" | "cloud-api").
 * Padrão "mock" para permitir testar toda a UI de conversas sem nenhuma
 * credencial da Meta. Ver README.md para ligar a Cloud API de verdade.
 */
export const whatsappProvider: WhatsAppProvider =
  process.env.WHATSAPP_PROVIDER === "cloud-api" ? cloudApiWhatsAppProvider : mockWhatsAppProvider;

export const isMockWhatsAppProvider = process.env.WHATSAPP_PROVIDER !== "cloud-api";

export type { WhatsAppProvider, NormalizedIncomingMessage, NormalizedStatusUpdate, NormalizedWebhookEvent } from "./types";
