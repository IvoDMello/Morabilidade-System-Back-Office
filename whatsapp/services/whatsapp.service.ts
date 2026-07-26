import { dataSource } from "./data";
import { createContact, getContactByPhone } from "./contacts.service";
import { notifyNewMessage } from "./push.service";
import { whatsappProvider } from "./whatsapp";
import type { NormalizedIncomingMessage, NormalizedStatusUpdate } from "./whatsapp";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import { formatPhone } from "@/lib/utils";
import type { ID } from "@/types/common";
import type { WhatsAppConversationSummary } from "@/types/whatsapp";

async function getOrCreateContactForIncomingMessage(message: NormalizedIncomingMessage) {
  const existing = await getContactByPhone(message.fromPhone);
  if (existing) return existing;

  return createContact({
    name: message.profileName || formatPhone(message.fromPhone),
    phone: message.fromPhone,
    category: "lead",
    status: "novo",
    nextAction: "ligar",
  });
}

export async function processIncomingMessage(message: NormalizedIncomingMessage) {
  if (message.waMessageId) {
    const existing = await dataSource.whatsapp.findMessageByWaId(message.waMessageId);
    if (existing) return existing;
  }

  const contact = await getOrCreateContactForIncomingMessage(message);
  const conversation = await dataSource.whatsapp.getOrCreateConversationForContact(
    contact.id,
    message.fromPhone,
  );

  const created = await dataSource.whatsapp.createMessage({
    conversationId: conversation.id,
    waMessageId: message.waMessageId,
    direction: "inbound",
    messageType: message.messageType,
    body: message.body,
    status: "received",
    waTimestamp: message.timestamp,
  });

  await dataSource.whatsapp.touchConversationOnNewMessage(
    conversation.id,
    message.body,
    message.timestamp,
    "inbound",
  );

  await notifyNewMessage({
    title: "Nova mensagem",
    body: `${contact.name}: ${message.body}`,
    url: `/?c=${contact.id}`,
  }).catch(() => {});

  return created;
}

export async function processStatusUpdate(update: NormalizedStatusUpdate) {
  return dataSource.whatsapp.updateMessageStatus(
    update.waMessageId,
    update.status,
    update.errorMessage ?? null,
  );
}

export async function sendMessage(contactId: ID, body: string) {
  const contact = await dataSource.contacts.getById(contactId);
  if (!contact) throw new Error("Contato não encontrado.");
  if (contact.isBlocked) throw new Error("Contato bloqueado — desbloqueie para enviar.");

  const conversation = await dataSource.whatsapp.getOrCreateConversationForContact(
    contactId,
    contact.phone,
  );

  const { providerMessageId } = await whatsappProvider.sendTextMessage({
    toPhone: contact.phone,
    body,
  });

  const nowIso = new Date().toISOString();
  const created = await dataSource.whatsapp.createMessage({
    conversationId: conversation.id,
    waMessageId: providerMessageId,
    direction: "outbound",
    body,
    status: "sent",
    createdBy: CURRENT_USER_NAME,
    waTimestamp: nowIso,
  });

  await dataSource.whatsapp.touchConversationOnNewMessage(conversation.id, body, nowIso, "outbound");

  return created;
}

export function getConversations() {
  return dataSource.whatsapp.listConversations();
}

/** Busca trechos dentro das mensagens (campo de busca da lista de conversas). */
export async function searchMessages(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return dataSource.whatsapp.searchMessages(trimmed);
}

export async function getConversationMessages(contactId: ID) {
  const conversation = await dataSource.whatsapp.getConversationByContactId(contactId);
  if (!conversation) return [];
  return dataSource.whatsapp.listMessages(conversation.id);
}

export async function markConversationRead(contactId: ID) {
  const conversation = await dataSource.whatsapp.getConversationByContactId(contactId);
  if (!conversation) return;
  await dataSource.whatsapp.markConversationRead(conversation.id);
}

export async function markConversationUnread(contactId: ID) {
  const conversation = await dataSource.whatsapp.getConversationByContactId(contactId);
  if (!conversation) return;
  await dataSource.whatsapp.markConversationUnread(conversation.id);
}

/** Apaga todas as mensagens da conversa e zera a prévia (ação destrutiva). */
export async function clearConversation(contactId: ID) {
  const conversation = await dataSource.whatsapp.getConversationByContactId(contactId);
  if (!conversation) return;
  await dataSource.whatsapp.clearConversation(conversation.id);
}

export function getUnreadConversationsCount() {
  return dataSource.whatsapp.countUnreadConversations();
}

/** Contador do badge do menu — só conversas que exigem resposta direta. */
export function getPendingConversationsCount() {
  return dataSource.whatsapp.countByStatus("aguardando_resposta");
}

export interface PendingConversationItem extends WhatsAppConversationSummary {
  property: { code: string; title: string | null } | null;
}

export interface PendingQueue {
  aguardandoResposta: PendingConversationItem[];
  followUpSugerido: PendingConversationItem[];
  todasAtivas: PendingConversationItem[];
}

function sortByOldestInbound(a: PendingConversationItem, b: PendingConversationItem) {
  const aTime = a.lastInboundAt ? new Date(a.lastInboundAt).getTime() : 0;
  const bTime = b.lastInboundAt ? new Date(b.lastInboundAt).getTime() : 0;
  return aTime - bTime;
}

/** Monta a fila de pendências (rota /pendencias): aguardando resposta, follow-ups
 * sugeridos e todas as conversas ativas, cada uma já com o imóvel vinculado ao contato. */
export async function getPendingQueue(): Promise<PendingQueue> {
  const conversations = await dataSource.whatsapp.listConversations();
  const active = conversations.filter((c) => c.status !== "encerrada");

  const contactIds = [...new Set(active.map((c) => c.contactId))];
  const propertyByContact = new Map(
    await Promise.all(
      contactIds.map(async (contactId) => {
        const links = await dataSource.properties.listByContact(contactId);
        const property = links[0] ? { code: links[0].code, title: links[0].title } : null;
        return [contactId, property] as const;
      }),
    ),
  );

  const withProperty: PendingConversationItem[] = active.map((c) => ({
    ...c,
    property: propertyByContact.get(c.contactId) ?? null,
  }));

  const now = Date.now();

  const aguardandoResposta = withProperty
    .filter((c) => c.status === "aguardando_resposta")
    .sort(sortByOldestInbound);

  const followUpSugerido = withProperty
    .filter(
      (c) =>
        c.status === "follow_up_sugerido" &&
        (!c.followUpSnoozedUntil || new Date(c.followUpSnoozedUntil).getTime() <= now),
    )
    .sort(sortByOldestInbound);

  const todasAtivas = [...withProperty].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  return { aguardandoResposta, followUpSugerido, todasAtivas };
}

/** Encerra a conversa manualmente (ação da fila de pendências). */
export async function closeConversation(conversationId: ID) {
  await dataSource.whatsapp.closeConversation(conversationId);
}

/** Adia a sugestão de follow-up por N dias (padrão 1) sem mudar o status. */
export async function snoozeFollowUp(conversationId: ID, days = 1) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  await dataSource.whatsapp.snoozeFollowUp(conversationId, until.toISOString());
}
