import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { ConversationStatus } from "@/constants/conversation-status";
import type { ID } from "./common";

export type WhatsAppMessageDirection = "inbound" | "outbound";
export type WhatsAppMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "unsupported";

export interface WhatsAppConversation {
  id: ID;
  contactId: ID;
  waPhoneNumber: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageDirection: WhatsAppMessageDirection | null;
  unreadCount: number;
  status: ConversationStatus;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  statusChangedAt: string;
  followUpSnoozedUntil: string | null;
  lastAlertAt: string | null;
  /** Fixada no topo da lista (padrão WhatsApp); null = não fixada. Ordena pelas mais recém-fixadas primeiro. */
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppConversationSummary extends WhatsAppConversation {
  contactName: string;
  contactPhone: string;
  contactIsFavorite: boolean;
  contactIsBlocked: boolean;
  /** Etiquetas do contato — alimentam o filtro de listas do inbox. */
  contactTagIds: ID[];
  /** Corretor responsável pelo contato — alimenta o filtro por corretor do inbox. */
  contactCorretorId: ID | null;
}

/** Trecho citado numa resposta (snapshot da mensagem original). */
export interface MessageReply {
  id: ID | null;
  body: string;
  direction: WhatsAppMessageDirection;
}

export interface WhatsAppMessage {
  id: ID;
  conversationId: ID;
  waMessageId: string | null;
  direction: WhatsAppMessageDirection;
  messageType: WhatsAppMessageType;
  /** Legenda da mídia ou texto da mensagem. Vazio quando a mídia não tem legenda. */
  body: string;
  status: WhatsAppMessageStatus;
  errorMessage: string | null;
  createdBy: string | null;
  /** Mensagem citada, se esta for uma resposta; null caso contrário. */
  replyTo: MessageReply | null;
  /** Mídia recebida: URL absoluta (mock/hospedada) ou caminho no bucket (cloud-api). null em mensagens de texto. */
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  waTimestamp: string;
  createdAt: string;
}

/** Mensagem encontrada pela busca global (campo de busca da lista de
 * conversas), já com o contato resolvido para exibição no resultado. */
export interface WhatsAppMessageSearchResult {
  messageId: ID;
  conversationId: ID;
  contactId: ID;
  contactName: string;
  direction: WhatsAppMessageDirection;
  body: string;
  waTimestamp: string;
}

export interface CreateWhatsAppMessageInput {
  conversationId: ID;
  waMessageId?: string | null;
  direction: WhatsAppMessageDirection;
  messageType?: WhatsAppMessageType;
  body: string;
  status: WhatsAppMessageStatus;
  createdBy?: string | null;
  replyTo?: MessageReply | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  waTimestamp: string;
}
