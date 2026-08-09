import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { WhatsAppMessageType } from "@/types/whatsapp";

/** Referência de mídia de uma mensagem recebida, ainda por resolver.
 * `metaMediaId` = id da Meta que precisa ser baixado (cloud-api);
 * `url` = mídia já hospedada e acessível (simulação/mock). */
export interface NormalizedIncomingMedia {
  metaMediaId?: string | null;
  url?: string | null;
  mimeType?: string | null;
  filename?: string | null;
}

export interface NormalizedIncomingMessage {
  waMessageId: string | null;
  fromPhone: string;
  profileName: string | null;
  body: string;
  messageType: WhatsAppMessageType;
  /** Presente quando a mensagem carrega mídia; null em mensagens de texto. */
  media: NormalizedIncomingMedia | null;
  timestamp: string;
}

/** Mensagem enviada pelo app WhatsApp Business do celular (modo coexistência).
 * A Meta ecoa essas mensagens no webhook (campo smb_message_echoes) para o CRM
 * espelhar a conversa — aqui `toPhone` é o cliente, não quem enviou. */
export interface NormalizedEchoMessage {
  waMessageId: string | null;
  toPhone: string;
  body: string;
  messageType: WhatsAppMessageType;
  media: NormalizedIncomingMedia | null;
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
  | { type: "echo"; data: NormalizedEchoMessage }
  | { type: "status"; data: NormalizedStatusUpdate };

export interface WhatsAppProvider {
  sendTextMessage(input: {
    toPhone: string;
    body: string;
  }): Promise<{ providerMessageId: string | null }>;
  /** Envia um template pré-aprovado pela Meta — único formato aceito fora da
   * janela de 24h desde a última mensagem do destinatário. `bodyParams`
   * preenche os {{1}}, {{2}}… do corpo do template, na ordem. */
  sendTemplateMessage(input: {
    toPhone: string;
    templateName: string;
    languageCode: string;
    bodyParams: string[];
  }): Promise<{ providerMessageId: string | null }>;
  verifyWebhookHandshake(params: {
    mode: string | null;
    token: string | null;
    challenge: string | null;
  }): string | null;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  parseWebhookPayload(rawBody: string): NormalizedWebhookEvent[];
  /** Baixa os bytes de uma mídia a partir do id da Meta. Só implementado no
   * provider cloud-api; o mock recebe mídia como URL já hospedada. */
  fetchMediaBytes?(
    metaMediaId: string,
  ): Promise<{ data: Uint8Array; mimeType: string } | null>;
}
