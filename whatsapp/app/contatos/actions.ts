"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import { contactFormSchema, type ContactFormValues } from "@/lib/validations/contact.schema";
import { noteFormSchema, type NoteFormValues } from "@/lib/validations/note.schema";
import { reminderFormSchema, type ReminderFormValues } from "@/lib/validations/reminder.schema";
import { tagFormSchema, type TagFormValues } from "@/lib/validations/tag.schema";
import {
  createContact,
  deleteContact,
  getContactById,
  getContacts,
  setContactFavorite,
  updateContact,
} from "@/services/contacts.service";
import { createNote } from "@/services/notes.service";
import {
  cancelReminder,
  completeReminder,
  createReminder,
  deleteReminder,
  getReminderById,
  updateReminder,
} from "@/services/reminders.service";
import { apagarEventoDeVisita } from "@/services/google-calendar.service";
import { addTagToContact, createTag, getTags, removeTagFromContact } from "@/services/tags.service";
import { getCorretores } from "@/services/corretores.service";
import { logEvent } from "@/services/events.service";
import {
  createProperty,
  findPropertyByCode,
  linkPropertyToContact,
  unlinkPropertyFromContact,
  updateContactPropertyStage,
  updateContactPropertyRelacao,
} from "@/services/properties.service";
import { fetchImovelByCodigo } from "@/lib/backoffice-api";
import { garantirClienteDoContato } from "@/services/clientes.service";
import { propertyLinkFormSchema, type PropertyLinkFormValues } from "@/lib/validations/property.schema";
import { generateConversationSummary, saveConversationSummary } from "@/services/ai.service";
import type { ID } from "@/types/common";
import { CONTACT_STATUS_LABELS, type ContactStatus } from "@/constants/contact-status";
import type { LossReason } from "@/constants/loss-reasons";
import { PROPERTY_STAGE_LABELS, type PropertyStage } from "@/constants/property-stages";
import { PROPERTY_RELATION_LABELS, type PropertyRelation } from "@/constants/property-relations";

function toContactInput(values: ContactFormValues) {
  const parsed = contactFormSchema.parse(values);
  return {
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email || null,
    category: parsed.category,
    status: parsed.status,
    nextAction: parsed.nextAction,
    // Só preenchidos quando o diálogo obrigatório de motivo da perda rodou
    // nesta sessão do formulário (ver LossReasonDialog em contact-form.tsx).
    ...(parsed.lossReason !== undefined ? { lossReason: parsed.lossReason } : {}),
    ...(parsed.lossReasonNote !== undefined
      ? { lossReasonNote: parsed.lossReasonNote || null }
      : {}),
    generalNotes: parsed.generalNotes || null,
  };
}

function toReminderAtIso(values: Pick<ReminderFormValues, "reminderDate" | "reminderTime">) {
  return new Date(`${values.reminderDate}T${values.reminderTime}`).toISOString();
}

/** Busca usada pela paleta de comando (⌘K / "/") na sidebar — nome, telefone ou e-mail. */
export async function searchContactsAction(query: string) {
  const term = query.trim();
  if (!term) return [];
  const results = await getContacts({ search: term, sortBy: "updatedAt" });
  return results.slice(0, 8);
}

export async function createContactAction(values: ContactFormValues) {
  const contact = await createContact(toContactInput(values));
  await logEvent({ contactId: contact.id, type: "contact_created", summary: "Contato criado" });
  revalidatePath("/contatos");
  revalidatePath("/dashboard");
  redirect(`/contatos/${contact.id}`);
}

export async function updateContactAction(id: ID, values: ContactFormValues) {
  const before = await getContactById(id);
  const input = toContactInput(values);
  await updateContact(id, input);
  if (before && input.status !== undefined && before.status !== input.status) {
    await logEvent({
      contactId: id,
      type: "status_changed",
      summary: `Status alterado para ${CONTACT_STATUS_LABELS[input.status]}`,
    });
  }

  // Um atendente que salvou a ficha com nome e categoria reais qualificou este
  // contato — é o momento certo de ele existir no cadastro do sistema, e não
  // só no chat. Best-effort: nunca atrapalha o salvamento.
  //
  // A porta era `category !== "lead"`, e "lead" deixou de existir: hoje as
  // quatro categorias são papéis reais, todas dignas de cadastro. O que ainda
  // segura contato sem identidade é `garantirClienteDoContato`, que recusa
  // quem só tem o telefone no lugar do nome.
  await garantirClienteDoContato({
    id,
    name: input.name,
    phone: input.phone,
    clienteId: before?.clienteId ?? null,
    category: input.category,
  });

  revalidatePath("/contatos");
  revalidatePath(`/contatos/${id}`);
  revalidatePath("/dashboard");
  redirect(`/contatos/${id}`);
}

export async function deleteContactAction(id: ID) {
  await deleteContact(id);
  revalidatePath("/contatos");
  revalidatePath("/dashboard");
  redirect("/contatos");
}

export async function addNoteAction(contactId: ID, values: NoteFormValues) {
  const parsed = noteFormSchema.parse(values);
  await createNote({ contactId, note: parsed.note, createdBy: CURRENT_USER_NAME });
  revalidatePath(`/contatos/${contactId}`);
}

export async function createReminderAction(contactId: ID, values: ReminderFormValues) {
  const parsed = reminderFormSchema.parse(values);
  const reminder = await createReminder({
    contactId,
    title: parsed.title,
    description: parsed.description || null,
    reminderAt: toReminderAtIso(parsed),
    createdBy: CURRENT_USER_NAME,
  });
  await logEvent({
    contactId,
    type: "reminder_created",
    summary: `Lembrete criado: ${reminder.title}`,
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/pendencias");
  revalidatePath("/dashboard");
}

export async function updateReminderAction(
  contactId: ID,
  reminderId: ID,
  values: ReminderFormValues,
) {
  const parsed = reminderFormSchema.parse(values);
  await updateReminder(reminderId, {
    title: parsed.title,
    description: parsed.description || null,
    reminderAt: toReminderAtIso(parsed),
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/pendencias");
  revalidatePath("/dashboard");
}

export async function completeReminderAction(contactId: ID, reminderId: ID) {
  const reminder = await completeReminder(reminderId);
  await logEvent({
    contactId,
    type: "reminder_completed",
    summary: `Lembrete concluído: ${reminder.title}`,
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/pendencias");
  revalidatePath("/dashboard");
}

export async function cancelReminderAction(contactId: ID, reminderId: ID) {
  const reminder = await cancelReminder(reminderId);
  await logEvent({
    contactId,
    type: "reminder_cancelled",
    summary: `Lembrete cancelado: ${reminder.title}`,
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/pendencias");
  revalidatePath("/dashboard");
}

export async function deleteReminderAction(contactId: ID, reminderId: ID) {
  const reminder = await getReminderById(reminderId);
  await deleteReminder(reminderId);
  if (reminder?.googleCalendarEventId) {
    await apagarEventoDeVisita(reminder.googleCalendarEventId);
  }
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/pendencias");
  revalidatePath("/dashboard");
}

export async function createTagAction(contactId: ID, values: TagFormValues) {
  const parsed = tagFormSchema.parse(values);
  const tag = await createTag({ name: parsed.name, color: parsed.color });
  await addTagToContact(contactId, tag.id);
  await logEvent({
    contactId,
    type: "tag_added",
    summary: `Etiqueta "${tag.name}" adicionada`,
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
  return tag;
}

export async function addTagToContactAction(contactId: ID, tagId: ID) {
  await addTagToContact(contactId, tagId);
  const tag = (await getTags()).find((t) => t.id === tagId);
  if (tag) {
    await logEvent({ contactId, type: "tag_added", summary: `Etiqueta "${tag.name}" adicionada` });
  }
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
}

export async function removeTagFromContactAction(contactId: ID, tagId: ID) {
  const tag = (await getTags()).find((t) => t.id === tagId);
  await removeTagFromContact(contactId, tagId);
  if (tag) {
    await logEvent({ contactId, type: "tag_removed", summary: `Etiqueta "${tag.name}" removida` });
  }
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
}

export async function toggleFavoriteAction(contactId: ID, isFavorite: boolean) {
  await setContactFavorite(contactId, isFavorite);
  revalidatePath("/contatos");
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/");
  revalidatePath("/dashboard");
}

/** Ações em lote da barra flutuante da lista de contatos (LT-2). */
export async function bulkUpdateStatusAction(contactIds: ID[], status: ContactStatus) {
  await Promise.all(
    contactIds.map(async (id) => {
      await updateContact(id, { status });
      await logEvent({
        contactId: id,
        type: "status_changed",
        summary: `Status alterado para ${CONTACT_STATUS_LABELS[status]}`,
      });
    }),
  );
  revalidatePath("/contatos");
  revalidatePath("/dashboard");
}

export async function bulkSetFavoriteAction(contactIds: ID[], isFavorite: boolean) {
  await Promise.all(contactIds.map((id) => setContactFavorite(id, isFavorite)));
  revalidatePath("/contatos");
  revalidatePath("/dashboard");
}

export async function bulkDeleteAction(contactIds: ID[]) {
  await Promise.all(contactIds.map((id) => deleteContact(id)));
  revalidatePath("/contatos");
  revalidatePath("/dashboard");
}

/** Usada pelo drag-and-drop do Pipeline — atualiza só o status, sem redirecionar. */
export async function updateContactStatusAction(
  contactId: ID,
  status: ContactStatus,
  lossReason?: LossReason | null,
  lossReasonNote?: string | null,
) {
  await updateContact(contactId, {
    status,
    ...(lossReason !== undefined ? { lossReason } : {}),
    ...(lossReasonNote !== undefined ? { lossReasonNote } : {}),
  });
  await logEvent({
    contactId,
    type: "status_changed",
    summary: `Status alterado para ${CONTACT_STATUS_LABELS[status]}`,
  });
  revalidatePath("/contatos");
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/dashboard");
}

export async function assignCorretorAction(contactId: ID, corretorId: string | null) {
  await updateContact(contactId, { corretorId });
  const corretor = corretorId
    ? (await getCorretores()).find((c) => c.id === corretorId)
    : null;
  await logEvent({
    contactId,
    type: "contact_assigned",
    summary: corretor ? `Responsável definido: ${corretor.nome}` : "Responsável removido",
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/contatos");
  revalidatePath("/");
}

export async function linkPropertyAction(contactId: ID, values: PropertyLinkFormValues) {
  const parsed = propertyLinkFormSchema.parse(values);
  let property = await findPropertyByCode(parsed.code);
  if (!property) {
    // Código novo no CRM: resolve o imóvel real no catálogo do back-office para
    // guardar o título de verdade como snapshot (best-effort — sem a API, cria
    // só com o código, como antes).
    const imovel = await fetchImovelByCodigo(parsed.code);
    property = await createProperty({ code: parsed.code, title: imovel?.titulo ?? null });
  }
  await linkPropertyToContact(contactId, property.id, parsed.relacao, parsed.stage);
  await logEvent({
    contactId,
    type: "property_linked",
    summary: `Imóvel "${property.code}" vinculado (${PROPERTY_RELATION_LABELS[parsed.relacao]})`,
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/contatos");
}

export async function updatePropertyRelacaoAction(
  contactId: ID,
  propertyId: ID,
  propertyCode: string,
  relacao: PropertyRelation,
) {
  await updateContactPropertyRelacao(contactId, propertyId, relacao);
  await logEvent({
    contactId,
    type: "property_relation_changed",
    summary: `Imóvel "${propertyCode}" — papel alterado para ${PROPERTY_RELATION_LABELS[relacao]}`,
  });
  revalidatePath(`/contatos/${contactId}`);
}

export async function updatePropertyStageAction(
  contactId: ID,
  propertyId: ID,
  propertyCode: string,
  stage: PropertyStage,
) {
  await updateContactPropertyStage(contactId, propertyId, stage);
  await logEvent({
    contactId,
    type: "property_stage_changed",
    summary: `Imóvel "${propertyCode}" — etapa alterada para ${PROPERTY_STAGE_LABELS[stage]}`,
  });
  revalidatePath(`/contatos/${contactId}`);
}

export async function unlinkPropertyAction(contactId: ID, propertyId: ID, propertyCode: string) {
  await unlinkPropertyFromContact(contactId, propertyId);
  await logEvent({
    contactId,
    type: "property_unlinked",
    summary: `Imóvel "${propertyCode}" desvinculado`,
  });
  revalidatePath(`/contatos/${contactId}`);
  revalidatePath("/contatos");
}

/** Gera (via IA) e salva o resumo de atendimento do contato — botão "Gerar Resumo". */
export async function generateSummaryAction(contactId: ID) {
  const summary = await generateConversationSummary(contactId);
  await saveConversationSummary(contactId, summary);
  revalidatePath(`/contatos/${contactId}`);
  return summary;
}
