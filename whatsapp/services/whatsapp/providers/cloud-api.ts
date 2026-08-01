import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { WhatsAppMessageType } from "@/types/whatsapp";
import type {
  NormalizedIncomingMedia,
  NormalizedWebhookEvent,
  WhatsAppProvider,
} from "../types";

const GRAPH_API_VERSION = "v22.0";

/* eslint-disable @typescript-eslint/no-explicit-any -- envelope cru da Meta */

function mapMetaStatus(status: string): WhatsAppMessageStatus {
  if (status === "sent" || status === "delivered" || status === "read" || status === "failed") {
    return status;
  }
  return "sent";
}

/** Tipos de mídia da Cloud API que sabemos exibir. */
const SUPPORTED_MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"] as const;

/** Traduz uma mensagem crua da Meta em (tipo, legenda, referência de mídia). */
function parseIncomingContent(message: any): {
  messageType: WhatsAppMessageType;
  body: string;
  media: NormalizedIncomingMedia | null;
} {
  if (message.type === "text") {
    return { messageType: "text", body: message.text?.body ?? "", media: null };
  }

  if ((SUPPORTED_MEDIA_TYPES as readonly string[]).includes(message.type)) {
    const payload = message[message.type] ?? {};
    return {
      messageType: message.type as WhatsAppMessageType,
      body: payload.caption ?? "",
      media: {
        metaMediaId: payload.id ?? null,
        mimeType: payload.mime_type ?? null,
        filename: payload.filename ?? null,
      },
    };
  }

  // location, contacts, reação, etc.: registrado como não suportado (sem mídia).
  return { messageType: "unsupported", body: "", media: null };
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

  async fetchMediaBytes(metaMediaId: string) {
    const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1ª chamada: resolve o id da mídia numa URL de download (curta duração).
    const metaResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${metaMediaId}`,
      { headers: authHeaders },
    );
    if (!metaResponse.ok) return null;

    const meta = (await metaResponse.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    // 2ª chamada: baixa os bytes de fato (também exige o mesmo bearer).
    const binaryResponse = await fetch(meta.url, { headers: authHeaders });
    if (!binaryResponse.ok) return null;

    const buffer = new Uint8Array(await binaryResponse.arrayBuffer());
    return {
      data: buffer,
      mimeType:
        binaryResponse.headers.get("content-type") ?? meta.mime_type ?? "application/octet-stream",
    };
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

          const { messageType, body, media } = parseIncomingContent(message);

          events.push({
            type: "message",
            data: {
              waMessageId: message.id,
              fromPhone: message.from,
              profileName,
              body,
              messageType,
              media,
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
