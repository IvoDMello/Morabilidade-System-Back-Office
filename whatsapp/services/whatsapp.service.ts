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
import { CONTACT_CATEGORY_PADRAO } from "@/constants/contact-categories";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import { formatPhone } from "@/lib/utils";
import { extFromMime, messagePreview } from "@/lib/whatsapp-media";
import type { ID } from "@/types/common";
import type {
  FailedOutboundMessage,
  MessageReply,
  WhatsAppConversationSummary,
  WhatsAppMessage,
} from "@/types/whatsapp";

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
    category: CONTACT_CATEGORY_PADRAO,
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
      category: CONTACT_CATEGORY_PADRAO,
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

/**
 * True se a conversa continua sem resposta ENTREGUE depois da última mensagem
 * do cliente. Um envio que falhou não conta como resposta — é exatamente essa
 * a confusão que este módulo existe para desfazer.
 */
function seguemSemRespostaEntregue(mensagens: WhatsAppMessage[]): boolean {
  const ultimaInbound = [...mensagens]
    .reverse()
    .find((m) => m.direction === "inbound");
  if (!ultimaInbound) return false;

  const corte = new Date(ultimaInbound.waTimestamp).getTime();
  return !mensagens.some(
    (m) =>
      m.direction === "outbound" &&
      m.status !== "failed" &&
      new Date(m.waTimestamp).getTime() >= corte,
  );
}

/**
 * Devolve a conversa para "aguardando resposta" quando o envio que a tirou da
 * fila acabou falhando.
 *
 * O problema que isto corrige: a mensagem é gravada como `sent` no instante do
 * envio, e o trigger de banco (`sync_conversation_status_on_message`, migration
 * 0009) põe a conversa em `respondida` no insert — antes de a Meta confirmar
 * qualquer coisa. O `failed` chega depois, por webhook de status, e atualizava
 * só a linha da mensagem. Resultado: o cliente não recebeu nada e a conversa
 * sumia das pendências. **Falhar no envio deixava o sistema num estado melhor
 * do que não ter respondido** — o modo de falha mais perverso do fluxo.
 *
 * Só reabre a partir de `respondida`, que é o estado que aquele envio causou.
 * `encerrada` foi decisão humana e não é desfeita por uma falha de entrega;
 * `follow_up_sugerido` já está sinalizada em outra fila e reabrir só trocaria
 * a etiqueta do problema de lugar.
 */
async function reabrirConversaSeEnvioFalhou(mensagem: WhatsAppMessage): Promise<void> {
  const conversa = await dataSource.whatsapp.getConversationById(mensagem.conversationId);
  if (!conversa || conversa.status !== "respondida") return;

  const mensagens = await dataSource.whatsapp.listMessages(mensagem.conversationId);
  if (!seguemSemRespostaEntregue(mensagens)) return;

  await dataSource.whatsapp.reopenConversationAsAwaiting(mensagem.conversationId);
}

export async function processStatusUpdate(update: NormalizedStatusUpdate) {
  const mensagem = await dataSource.whatsapp.updateMessageStatus(
    update.waMessageId,
    update.status,
    update.errorMessage ?? null,
  );

  if (mensagem && update.status === "failed") {
    // Best-effort: a falha já está gravada na mensagem, e não conseguir
    // reabrir a conversa não pode derrubar o webhook (a Meta reentregaria o
    // status e nada melhoraria). O pior caso volta a ser o comportamento
    // antigo, não um erro novo.
    await reabrirConversaSeEnvioFalhou(mensagem).catch((erro) => {
      console.error("[whatsapp] envio falhou e a conversa não voltou para a fila:", erro);
    });
  }

  return mensagem;
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
  /**
   * O recorte da IA sobre `aguardandoResposta`: só as conversas em que o
   * cliente realmente espera algo (migration 0026). Conversa ainda não triada
   * NÃO entra aqui — a fila promete "isto foi lido e pede resposta", e uma
   * promessa dessas não se cumpre por omissão.
   */
  precisaResposta: PendingConversationItem[];
  aguardandoResposta: PendingConversationItem[];
  followUpSugerido: PendingConversationItem[];
  todasAtivas: PendingConversationItem[];
}

/** Quanto tempo a fila de falhas olha para trás. Uma semana cobre a semana de
 * trabalho e mantém a lista acionável — falha de 20 dias atrás não é pendência,
 * é histórico. */
const DIAS_FALHAS_VISIVEIS = 7;

/**
 * Envios recusados pela Meta, mais recentes primeiro.
 *
 * Best-effort de propósito: esta é uma aba a mais numa tela que já funciona.
 * Se a consulta falhar, a lista vem vazia e o resto de /pendencias continua
 * inteiro — o mesmo tratamento que o placar do agente recebe.
 */
export async function getFailedOutbound(): Promise<FailedOutboundMessage[]> {
  const desde = new Date(Date.now() - DIAS_FALHAS_VISIVEIS * 24 * 60 * 60 * 1000).toISOString();
  try {
    return await dataSource.whatsapp.listFailedOutbound(desde);
  } catch (erro) {
    console.error("[whatsapp] não foi possível listar os envios falhados:", erro);
    return [];
  }
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

  // Quem espera há mais tempo primeiro — a fila existe para achar quem está no
  // vácuo, e quem está no vácuo há mais tempo é o caso mais grave.
  const precisaResposta = aguardandoResposta.filter(
    (c) => c.triagemPrecisaResposta === true,
  );

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

  return { precisaResposta, aguardandoResposta, followUpSugerido, todasAtivas };
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
