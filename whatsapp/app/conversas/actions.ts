"use server";

import { revalidatePath } from "next/cache";
import { messageFormSchema, type MessageFormValues } from "@/lib/validations/message.schema";
import {
  simulateMessageFormSchema,
  type SimulateMessageFormValues,
} from "@/lib/validations/simulate-message.schema";
import { isMockWhatsAppProvider, whatsappProvider } from "@/services/whatsapp";
import {
  clearConversation,
  markConversationRead,
  markConversationUnread,
  processIncomingMessage,
  sendMessage,
  setConversationPinned,
} from "@/services/whatsapp.service";
import { setContactBlocked } from "@/services/contacts.service";
import { createTag } from "@/services/tags.service";
import { logEvent } from "@/services/events.service";
import { createTemplate, deleteTemplate } from "@/services/templates.service";
import { templateFormSchema, type TemplateFormValues } from "@/lib/validations/template.schema";
import { generateFollowUpSuggestion } from "@/services/ai.service";
import type { ID } from "@/types/common";
import type { MessageReply } from "@/types/whatsapp";

export async function sendMessageAction(
  contactId: ID,
  values: MessageFormValues,
  replyTo?: MessageReply | null,
) {
  const parsed = messageFormSchema.parse(values);
  await sendMessage(contactId, parsed.body, replyTo ?? null);
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
}

export async function markConversationReadAction(contactId: ID) {
  await markConversationRead(contactId);
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
}

export async function markConversationUnreadAction(contactId: ID) {
  await markConversationUnread(contactId);
  revalidatePath("/");
}

export async function setConversationPinnedAction(contactId: ID, pinned: boolean) {
  await setConversationPinned(contactId, pinned);
  revalidatePath("/");
}

/** Apaga todas as mensagens da conversa (irreversível — confirmar antes). */
export async function clearConversationAction(contactId: ID) {
  await clearConversation(contactId);
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
}

export async function setContactBlockedAction(contactId: ID, isBlocked: boolean) {
  await setContactBlocked(contactId, isBlocked);
  await logEvent({
    contactId,
    type: isBlocked ? "contact_blocked" : "contact_unblocked",
    summary: isBlocked ? "Contato bloqueado" : "Contato desbloqueado",
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
}

/** Cria uma lista (etiqueta) nova a partir do filtro do inbox. */
export async function createListAction(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Informe um nome para a lista.");
  const tag = await createTag({ name: trimmed });
  revalidatePath("/");
  return tag;
}

export async function simulateIncomingMessageAction(values: SimulateMessageFormValues) {
  if (!isMockWhatsAppProvider) {
    throw new Error("Simulação disponível apenas no modo mock.");
  }

  const parsed = simulateMessageFormSchema.parse(values);
  const events = whatsappProvider.parseWebhookPayload(
    JSON.stringify({
      from: parsed.phone,
      profileName: parsed.profileName || null,
      body: parsed.body,
    }),
  );

  for (const event of events) {
    if (event.type === "message") await processIncomingMessage(event.data);
  }

  revalidatePath("/");
  revalidatePath("/contatos");
}

export async function createTemplateAction(contactId: ID, values: TemplateFormValues) {
  const parsed = templateFormSchema.parse(values);
  const template = await createTemplate(parsed);
  revalidatePath(`/contatos/${contactId}`);
  return template;
}

export async function deleteTemplateAction(contactId: ID, templateId: ID) {
  await deleteTemplate(templateId);
  revalidatePath(`/contatos/${contactId}`);
}

/** Gera (via IA) uma sugestão de mensagem de follow-up — não persiste, é um rascunho. */
export async function generateFollowUpAction(contactId: ID) {
  return generateFollowUpSuggestion(contactId);
}
