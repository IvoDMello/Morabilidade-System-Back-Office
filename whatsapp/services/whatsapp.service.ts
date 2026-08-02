import { dataSource } from "./data";
import { createContact, getContactByPhone } from "./contacts.service";
import { notifyNewMessage } from "./push.service";
import { whatsappProvider } from "./whatsapp";
import type {
  NormalizedEchoMessage,
  NormalizedIncomingMedia,
  NormalizedIncomingMessage,
  NormalizedStatusUpdate,
} from "./whatsapp";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import { formatPhone } from "@/lib/utils";
import { extFromMime, messagePreview } from "@/lib/whatsapp-media";
import type { ID } from "@/types/common";
import type { MessageReply, WhatsAppConversationSummary } from "@/types/whatsapp";

interface ResolvedMedia {
  mediaUrl: string;
  mediaMimeType: string | null;
  mediaFilename: string | null;
}

/**
 * Transforma a referência de mídia da mensagem recebida em algo exibível:
 * - `url` (simulação/mock): já hospedada, usada direto;
 * - `metaMediaId` (cloud-api): baixa os bytes da Meta e guarda no storage.
 * Best-effort: qualquer falha vira `null` — a mensagem ainda é gravada como
 * seu tipo (foto/áudio/…), só sem a mídia carregada.
 */
async function resolveIncomingMedia(
  media: NormalizedIncomingMedia | null,
  conversationId: ID,
): Promise<ResolvedMedia | null> {
  if (!media) return null;

  if (media.url) {
    return {
      mediaUrl: media.url,
      mediaMimeType: media.mimeType ?? null,
      mediaFilename: media.filename ?? null,
    };
  }

  if (!media.metaMediaId || !whatsappProvider.fetchMediaBytes || !dataSource.whatsapp.uploadMedia) {
    return null;
  }

  try {
    const fetched = await whatsappProvider.fetchMediaBytes(media.metaMediaId);
    if (!fetched) return null;

    const path = `${conversationId}/${crypto.randomUUID()}.${extFromMime(fetched.mimeType)}`;
    const storedPath = await dataSource.whatsapp.uploadMedia(path, fetched.data, fetched.mimeType);
    return {
      mediaUrl: storedPath,
      mediaMimeType: fetched.mimeType,
      mediaFilename: media.filename ?? null,
    };
  } catch {
    return null;
  }
}

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

  const media = await resolveIncomingMedia(message.media, conversation.id);
  const preview = messagePreview(message.messageType, message.body);

  const created = await dataSource.whatsapp.createMessage({
    conversationId: conversation.id,
    waMessageId: message.waMessageId,
    direction: "inbound",
    messageType: message.messageType,
    body: message.body,
    status: "received",
    mediaUrl: media?.mediaUrl ?? null,
    mediaMimeType: media?.mediaMimeType ?? null,
    mediaFilename: media?.mediaFilename ?? null,
    waTimestamp: message.timestamp,
  });

  await dataSource.whatsapp.touchConversationOnNewMessage(
    conversation.id,
    preview,
    message.timestamp,
    "inbound",
  );

  await notifyNewMessage({
    title: "Nova mensagem",
    body: `${contact.name}: ${preview}`,
    url: `/?c=${contact.id}`,
  }).catch(() => {});

  return created;
}

/** Autor registrado nas mensagens ecoadas do app do celular (coexistência). */
export const ECHO_CREATED_BY = "WhatsApp Business (celular)";

/**
 * Coexistência: registra no CRM uma mensagem que a equipe enviou pelo app
 * WhatsApp Business do celular. Entra como outbound na conversa do cliente —
 * inclusive tirando a conversa de "aguardando resposta", já que o cliente foi
 * de fato respondido (só que por fora do CRM).
 */
export async function processEchoMessage(message: NormalizedEchoMessage) {
  if (message.waMessageId) {
    const existing = await dataSource.whatsapp.findMessageByWaId(message.waMessageId);
    if (existing) return existing;
  }

  // O cliente pode nem existir no CRM ainda (conversa iniciada pelo celular).
  const contact =
    (await getContactByPhone(message.toPhone)) ??
    (await createContact({
      name: formatPhone(message.toPhone),
      phone: message.toPhone,
      category: "lead",
      status: "novo",
      nextAction: "ligar",
    }));

  const conversation = await dataSource.whatsapp.getOrCreateConversationForContact(
    contact.id,
    message.toPhone,
  );

  const media = await resolveIncomingMedia(message.media, conversation.id);
  const preview = messagePreview(message.messageType, message.body);

  const created = await dataSource.whatsapp.createMessage({
    conversationId: conversation.id,
    waMessageId: message.waMessageId,
    direction: "outbound",
    messageType: message.messageType,
    body: message.body,
    status: "sent",
    createdBy: ECHO_CREATED_BY,
    mediaUrl: media?.mediaUrl ?? null,
    mediaMimeType: media?.mediaMimeType ?? null,
    mediaFilename: media?.mediaFilename ?? null,
    waTimestamp: message.timestamp,
  });

  await dataSource.whatsapp.touchConversationOnNewMessage(
    conversation.id,
    preview,
    message.timestamp,
    "outbound",
  );

  return created;
}

export async function processStatusUpdate(update: NormalizedStatusUpdate) {
  return dataSource.whatsapp.updateMessageStatus(
    update.waMessageId,
    update.status,
    update.errorMessage ?? null,
  );
}

export async function sendMessage(contactId: ID, body: string, replyTo?: MessageReply | null) {
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

  return registerOutboundMessage({
    conversationId: conversation.id,
    body,
    providerMessageId,
    createdBy: CURRENT_USER_NAME,
    replyTo: replyTo ?? null,
  });
}

/** Autor das mensagens disparadas pelo cron da ficha de visita. */
export const FICHA_AUTOMATICA_CREATED_BY = "Ficha automática";

/**
 * Grava na conversa uma mensagem que JÁ FOI enviada ao provedor. Existe porque
 * nem todo envio passa por `sendMessage`: o cron da ficha de visita pode
 * entregar via template, e mesmo assim o atendente precisa ver na thread que
 * aquele link foi mandado — senão ele abre o chat e acha que ninguém avisou.
 */
export async function registerOutboundMessage(input: {
  conversationId: ID;
  body: string;
  providerMessageId: string | null;
  createdBy: string;
  replyTo?: MessageReply | null;
}) {
  const nowIso = new Date().toISOString();
  const created = await dataSource.whatsapp.createMessage({
    conversationId: input.conversationId,
    waMessageId: input.providerMessageId,
    direction: "outbound",
    body: input.body,
    status: "sent",
    createdBy: input.createdBy,
    replyTo: input.replyTo ?? null,
    waTimestamp: nowIso,
  });

  await dataSource.whatsapp.touchConversationOnNewMessage(
    input.conversationId,
    input.body,
    nowIso,
    "outbound",
  );

  return created;
}

/** Conversa do contato, criando-a se ainda não existir (o cron precisa disso
 * para registrar a mensagem da ficha mesmo em contato que nunca escreveu). */
export async function getOrCreateConversation(contactId: ID, phone: string) {
  return dataSource.whatsapp.getOrCreateConversationForContact(contactId, phone);
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

/** Fixa/desafixa a conversa do contato no topo da lista (padrão WhatsApp). */
export async function setConversationPinned(contactId: ID, pinned: boolean) {
  const conversation = await dataSource.whatsapp.getConversationByContactId(contactId);
  if (!conversation) return;
  await dataSource.whatsapp.setConversationPinned(
    conversation.id,
    pinned ? new Date().toISOString() : null,
  );
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
