import { normalizePhone } from "@/lib/phone";
import type { WhatsAppMessageType } from "@/types/whatsapp";
import type { NormalizedWebhookEvent, WhatsAppProvider } from "../types";

/**
 * Provider de desenvolvimento: nunca fala com nada externo. `sendTextMessage`
 * só gera um id fake; `parseWebhookPayload` entende o JSON simples que a
 * ferramenta de simulação na tela de conversas (/) monta — o mesmo formato que a rota
 * de webhook real receberia, só que sem o envelope da Meta.
 */
export const mockWhatsAppProvider: WhatsAppProvider = {
  async sendTextMessage() {
    return { providerMessageId: `mock-${crypto.randomUUID()}` };
  },

  verifyWebhookHandshake({ challenge }) {
    return challenge;
  },

  verifyWebhookSignature() {
    return true;
  },

  parseWebhookPayload(rawBody: string): NormalizedWebhookEvent[] {
    const parsed = JSON.parse(rawBody) as {
      from: string;
      profileName?: string | null;
      body: string;
      // Simulação de mídia recebida: uma URL já hospedada (acessível pelo navegador).
      mediaUrl?: string | null;
      mediaType?: WhatsAppMessageType | null;
    };

    const mediaUrl = parsed.mediaUrl?.trim() || null;
    const messageType: WhatsAppMessageType = mediaUrl ? (parsed.mediaType ?? "image") : "text";

    return [
      {
        type: "message",
        data: {
          waMessageId: null,
          fromPhone: normalizePhone(parsed.from),
          profileName: parsed.profileName?.trim() || null,
          body: parsed.body,
          messageType,
          media: mediaUrl ? { url: mediaUrl } : null,
          timestamp: new Date().toISOString(),
        },
      },
    ];
  },
};
