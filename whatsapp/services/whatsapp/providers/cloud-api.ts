import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { NormalizedWebhookEvent, WhatsAppProvider } from "../types";

const GRAPH_API_VERSION = "v22.0";

/* eslint-disable @typescript-eslint/no-explicit-any -- envelope cru da Meta */

function mapMetaStatus(status: string): WhatsAppMessageStatus {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return "sent";
}

export const cloudApiWhatsAppProvider: WhatsAppProvider = {
  async sendTextMessage({ toPhone, body }) {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhone,
          type: "text",
          text: { body },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Falha ao enviar mensagem pela Cloud API: ${errorBody}`);
    }

    const data = (await response.json()) as { messages?: { id: string }[] };
    return { providerMessageId: data.messages?.[0]?.id ?? null };
  },

  verifyWebhookHandshake({ mode, token, challenge }) {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  },

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

    const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    const received = signatureHeader.slice("sha256=".length);

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(received, "hex");
    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  },

  parseWebhookPayload(rawBody: string): NormalizedWebhookEvent[] {
    const payload = JSON.parse(rawBody);
    const events: NormalizedWebhookEvent[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        for (const message of value?.messages ?? []) {
          const profileName =
            value.contacts?.find((c: any) => c.wa_id === message.from)?.profile?.name ?? null;

          events.push({
            type: "message",
            data: {
              waMessageId: message.id,
              fromPhone: message.from,
              profileName,
              body:
                message.type === "text"
                  ? (message.text?.body ?? "")
                  : "[Mensagem de mídia não suportada ainda]",
              messageType: message.type === "text" ? "text" : "unsupported",
              timestamp: new Date(Number(message.timestamp) * 1000).toISOString(),
            },
          });
        }

        for (const status of value?.statuses ?? []) {
          events.push({
            type: "status",
            data: {
              waMessageId: status.id,
              status: mapMetaStatus(status.status),
              errorMessage: status.errors?.[0]?.message ?? status.errors?.[0]?.title ?? null,
              timestamp: new Date(Number(status.timestamp) * 1000).toISOString(),
            },
          });
        }
      }
    }

    return events;
  },
};
