import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { ConversationStatus } from "@/constants/conversation-status";
import type { ID } from "@/types/common";
import type {
  CreateWhatsAppMessageInput,
  FailedOutboundMessage,
  WhatsAppConversation,
  WhatsAppConversationSummary,
  WhatsAppMessage,
  WhatsAppMessageDirection,
} from "@/types/whatsapp";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

function normalizeForSearch(text: string): string {
  // Remove diacríticos (NFD separa a letra do acento) para busca sem acento.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function withContact(conversation: WhatsAppConversation): WhatsAppConversationSummary {
  const contact = mockStore.contacts.find((c) => c.id === conversation.contactId);
  return {
    ...conversation,
    contactName: contact?.name ?? "Contato removido",
    contactPhone: contact?.phone ?? conversation.waPhoneNumber,
    contactIsFavorite: contact?.isFavorite ?? false,
    contactIsBlocked: contact?.isBlocked ?? false,
    contactTagIds: mockStore.contactTags
      .filter((ct) => ct.contactId === conversation.contactId)
      .map((ct) => ct.tagId),
    contactCorretorId: contact?.corretorId ?? null,
  };
}

export const mockWhatsapp: DataSource["whatsapp"] = {
  async listConversations() {
    return [...mockStore.conversations]
      .map(withContact)
      .sort((a, b) => {
        // Fixadas primeiro (mais recém-fixadas no topo), depois por última mensagem.
        const aPin = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const bPin = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        if (aPin !== bPin) return bPin - aPin;
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
  },

  async getConversationByContactId(contactId: ID) {
    return mockStore.conversations.find((c) => c.contactId === contactId) ?? null;
  },

  async getOrCreateConversationForContact(contactId: ID, waPhoneNumber: string) {
    const existing = mockStore.conversations.find((c) => c.contactId === contactId);
    if (existing) return existing;

    const nowIso = new Date().toISOString();
    const newConversation: WhatsAppConversation = {
      id: generateId(),
      contactId,
      waPhoneNumber,
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageDirection: null,
      unreadCount: 0,
      status: "aguardando_resposta",
      lastInboundAt: null,
      lastOutboundAt: null,
      statusChangedAt: nowIso,
      followUpSnoozedUntil: null,
      lastAlertAt: null,
      pinnedAt: null,
      triagemPrecisaResposta: null,
      triagemMotivo: null,
      triagemMensagemEm: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    mockStore.conversations.push(newConversation);
    return newConversation;
  },

  async getConversationById(conversationId: ID) {
    return mockStore.conversations.find((c) => c.id === conversationId) ?? null;
  },

  async listMessages(conversationId: ID) {
    return mockStore.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.waTimestamp).getTime() - new Date(b.waTimestamp).getTime());
  },

  async reopenConversationAsAwaiting(conversationId: ID) {
    const conversa = mockStore.conversations.find((c) => c.id === conversationId);
    // Só a partir de `respondida` — espelha a condição do UPDATE no Supabase.
    if (!conversa || conversa.status !== "respondida") return;
    conversa.status = "aguardando_resposta";
    conversa.statusChangedAt = new Date().toISOString();
  },

  async listFailedOutbound(sinceIso: string, limit = 50) {
    const corte = new Date(sinceIso).getTime();
    return mockStore.messages
      .filter(
        (m) =>
          m.direction === "outbound" &&
          m.status === "failed" &&
          new Date(m.waTimestamp).getTime() >= corte,
      )
      .sort((a, b) => new Date(b.waTimestamp).getTime() - new Date(a.waTimestamp).getTime())
      .slice(0, limit)
      .map((m): FailedOutboundMessage => {
        const conversa = mockStore.conversations.find((c) => c.id === m.conversationId);
        const contato = mockStore.contacts.find((c) => c.id === conversa?.contactId);
        return {
          id: m.id,
          conversationId: m.conversationId,
          contactId: conversa?.contactId ?? "",
          contactName: contato?.name ?? "Contato",
          contactPhone: contato?.phone ?? "",
          body: m.body,
          errorMessage: m.errorMessage,
          createdBy: m.createdBy,
          waTimestamp: m.waTimestamp,
        };
      });
  },

  async searchMessages(query: string, limit = 50) {
    const normalizedQuery = normalizeForSearch(query);
    return mockStore.messages
      .filter((m) => normalizeForSearch(m.body).includes(normalizedQuery))
      .sort((a, b) => new Date(b.waTimestamp).getTime() - new Date(a.waTimestamp).getTime())
      .slice(0, limit)
      .map((message) => {
        const conversation = mockStore.conversations.find(
          (c) => c.id === message.conversationId,
        );
        const contact = mockStore.contacts.find((c) => c.id === conversation?.contactId);
        return {
          messageId: message.id,
          conversationId: message.conversationId,
          contactId: conversation?.contactId ?? "",
          contactName: contact?.name ?? "Contato removido",
          direction: message.direction,
          body: message.body,
          waTimestamp: message.waTimestamp,
        };
      });
  },

  async createMessage(input: CreateWhatsAppMessageInput) {
    const newMessage: WhatsAppMessage = {
      id: generateId(),
      conversationId: input.conversationId,
      waMessageId: input.waMessageId ?? null,
      direction: input.direction,
      messageType: input.messageType ?? "text",
      body: input.body,
      status: input.status,
      errorMessage: null,
      createdBy: input.createdBy ?? null,
      replyTo: input.replyTo ?? null,
      mediaUrl: input.mediaUrl ?? null,
      mediaMimeType: input.mediaMimeType ?? null,
      mediaFilename: input.mediaFilename ?? null,
      waTimestamp: input.waTimestamp,
      createdAt: new Date().toISOString(),
    };
    mockStore.messages.push(newMessage);
    return newMessage;
  },

  async findMessageByWaId(waMessageId: string) {
    return mockStore.messages.find((m) => m.waMessageId === waMessageId) ?? null;
  },

  async updateMessageStatus(
    waMessageId: string,
    status: WhatsAppMessageStatus,
    errorMessage: string | null = null,
  ) {
    const index = mockStore.messages.findIndex((m) => m.waMessageId === waMessageId);
    if (index === -1) return null;

    const updated: WhatsAppMessage = { ...mockStore.messages[index], status, errorMessage };
    mockStore.messages[index] = updated;
    return updated;
  },

  async touchConversationOnNewMessage(
    conversationId: ID,
    preview: string,
    timestampIso: string,
    direction: WhatsAppMessageDirection,
  ) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;

    const current = mockStore.conversations[index];
    // Espelha o trigger sync_conversation_status_on_message (migrations 0009/0010),
    // já que o mock não tem banco/trigger de verdade.
    const nextStatus: ConversationStatus = direction === "inbound" ? "aguardando_resposta" : "respondida";
    mockStore.conversations[index] = {
      ...current,
      lastMessageAt: timestampIso,
      lastMessagePreview: preview,
      lastMessageDirection: direction,
      unreadCount: direction === "inbound" ? current.unreadCount + 1 : current.unreadCount,
      status: nextStatus,
      lastInboundAt: direction === "inbound" ? timestampIso : current.lastInboundAt,
      lastOutboundAt: direction === "outbound" ? timestampIso : current.lastOutboundAt,
      statusChangedAt: current.status !== nextStatus ? new Date().toISOString() : current.statusChangedAt,
      followUpSnoozedUntil: null,
      updatedAt: new Date().toISOString(),
    };
  },

  async markConversationRead(conversationId: ID) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    };
  },

  async setConversationPinned(conversationId: ID, pinnedAt: string | null) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      pinnedAt,
      updatedAt: new Date().toISOString(),
    };
  },

  async markConversationUnread(conversationId: ID) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    const current = mockStore.conversations[index];
    if (current.unreadCount > 0) return;
    mockStore.conversations[index] = {
      ...current,
      unreadCount: 1,
      updatedAt: new Date().toISOString(),
    };
  },

  async clearConversation(conversationId: ID) {
    mockStore.messages = mockStore.messages.filter((m) => m.conversationId !== conversationId);
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageDirection: null,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    };
  },

  async countUnreadConversations() {
    return mockStore.conversations.filter((c) => c.unreadCount > 0).length;
  },

  async countByStatus(status: ConversationStatus) {
    return mockStore.conversations.filter((c) => c.status === status).length;
  },

  async closeConversation(conversationId: ID) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      status: "encerrada",
      statusChangedAt: new Date().toISOString(),
    };
  },

  async snoozeFollowUp(conversationId: ID, untilIso: string) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      followUpSnoozedUntil: untilIso,
    };
  },

  async markStaleRespondidasAsFollowUp(cutoffIso: string) {
    const cutoff = new Date(cutoffIso).getTime();
    let changed = 0;
    mockStore.conversations = mockStore.conversations.map((c) => {
      if (c.status !== "respondida" || !c.lastInboundAt) return c;
      if (new Date(c.lastInboundAt).getTime() > cutoff) return c;
      changed++;
      return { ...c, status: "follow_up_sugerido", statusChangedAt: new Date().toISOString() };
    });
    return changed;
  },

  async listOverdueAwaiting(alertCutoffIso: string, todayStartIso: string) {
    const alertCutoff = new Date(alertCutoffIso).getTime();
    const todayStart = new Date(todayStartIso).getTime();
    return mockStore.conversations
      .filter((c) => {
        if (c.status !== "aguardando_resposta" || !c.lastInboundAt) return false;
        if (new Date(c.lastInboundAt).getTime() > alertCutoff) return false;
        if (!c.lastAlertAt) return true;
        return new Date(c.lastAlertAt).getTime() < todayStart;
      })
      .map(withContact);
  },

  async markAlerted(conversationId: ID, whenIso: string) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      lastAlertAt: whenIso,
    };
  },

  async salvarTriagem(
    conversationId: ID,
    triagem: { precisaResposta: boolean; motivo: string; mensagemEm: string | null },
  ) {
    const index = mockStore.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) return;
    mockStore.conversations[index] = {
      ...mockStore.conversations[index],
      triagemPrecisaResposta: triagem.precisaResposta,
      triagemMotivo: triagem.motivo,
      triagemMensagemEm: triagem.mensagemEm,
    };
  },
};
