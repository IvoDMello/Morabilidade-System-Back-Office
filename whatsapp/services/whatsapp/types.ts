import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { WhatsAppMessageType } from "@/types/whatsapp";

export interface NormalizedIncomingMessage {
  waMessageId: string | null;
  fromPhone: string;
  profileName: string | null;
  body: string;
  messageType: WhatsAppMessageType;
  timestamp: string;
}

export interface NormalizedStatusUpdate {
  waMessageId: string;
  status: WhatsAppMessageStatus;
  errorMessage?: string | null;
  timestamp: string;
}

export type NormalizedWebhookEvent =
  | { type: "message"; data: NormalizedIncomingMessage }
  | { type: "status"; data: NormalizedStatusUpdate };

export interface WhatsAppProvider {
  sendTextMessage(input: {
    toPhone: string;
    body: string;
  }): Promise<{ providerMessageId: string | null }>;
  verifyWebhookHandshake(params: {
    mode: string | null;
    token: string | null;
    challenge: string | null;
  }): string | null;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  parseWebhookPayload(rawBody: string): NormalizedWebhookEvent[];
}
