import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { ConversationStatus } from "@/constants/conversation-status";
import type { ID } from "./common";

export type WhatsAppMessageDirection = "inbound" | "outbound";
export type WhatsAppMessageType = "text" | "unsupported";

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
}

export interface WhatsAppMessage {
  id: ID;
  conversationId: ID;
  waMessageId: string | null;
  direction: WhatsAppMessageDirection;
  messageType: WhatsAppMessageType;
  body: string;
  status: WhatsAppMessageStatus;
  errorMessage: string | null;
  createdBy: string | null;
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
  waTimestamp: string;
}
