import type { Contact } from "@/types/contact";
import type { ContactNote } from "@/types/note";
import type { ContactReminder, ReminderWithContact } from "@/types/reminder";
import type { Tag } from "@/types/tag";
import type { ContactEvent } from "@/types/event";
import type { MessageTemplate } from "@/types/template";
import type { ContactPropertyWithDetails, Property } from "@/types/property";
import type {
  WhatsAppConversation,
  WhatsAppConversationSummary,
  WhatsAppMessage,
  WhatsAppMessageSearchResult,
} from "@/types/whatsapp";
import type { PushSubscriptionRecord } from "@/types/push";

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas cruas do Supabase (snake_case) */

export function mapContactRow(row: any): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    category: row.category,
    status: row.status,
    nextAction: row.next_action,
    isFavorite: row.is_favorite,
    isBlocked: row.is_blocked ?? false,
    lossReason: row.loss_reason,
    lossReasonNote: row.loss_reason_note,
    generalNotes: row.general_notes,
    aiSummary: row.ai_summary,
    aiSummaryGeneratedAt: row.ai_summary_generated_at,
    clienteId: row.cliente_id ?? null,
    clienteCodigo: row.cliente_codigo ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNoteRow(row: any): ContactNote {
  return {
    id: row.id,
    contactId: row.contact_id,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapReminderRow(row: any): ContactReminder {
  return {
    id: row.id,
    contactId: row.contact_id,
    title: row.title,
    description: row.description,
    reminderAt: row.reminder_at,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapReminderWithContactRow(row: any): ReminderWithContact {
  return {
    ...mapReminderRow(row),
    contactName: row.contacts?.name ?? "Contato removido",
    contactPhone: row.contacts?.phone ?? "",
  };
}

export function mapTagRow(row: any): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export function mapConversationRow(row: any): WhatsAppConversation {
  return {
    id: row.id,
    contactId: row.contact_id,
    waPhoneNumber: row.wa_phone_number,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    lastMessageDirection: row.last_message_direction,
    unreadCount: row.unread_count,
    status: row.status ?? "aguardando_resposta",
    lastInboundAt: row.last_inbound_at,
    lastOutboundAt: row.last_outbound_at,
    statusChangedAt: row.status_changed_at ?? row.created_at,
    followUpSnoozedUntil: row.follow_up_snoozed_until,
    lastAlertAt: row.last_alert_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapConversationSummaryRow(row: any): WhatsAppConversationSummary {
  return {
    ...mapConversationRow(row),
    contactName: row.contacts?.name ?? "Contato removido",
    contactPhone: row.contacts?.phone ?? row.wa_phone_number,
    contactIsFavorite: row.contacts?.is_favorite ?? false,
    contactIsBlocked: row.contacts?.is_blocked ?? false,
    contactTagIds: (row.contacts?.contact_tags ?? []).map(
      (ct: { tag_id: string }) => ct.tag_id,
    ),
  };
}

export function mapEventRow(row: any): ContactEvent {
  return {
    id: row.id,
    contactId: row.contact_id,
    type: row.type,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

export function mapTemplateRow(row: any): MessageTemplate {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function mapPropertyRow(row: any): Property {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    createdAt: row.created_at,
  };
}

export function mapContactPropertyRow(row: any): ContactPropertyWithDetails {
  return {
    contactId: row.contact_id,
    propertyId: row.property_id,
    stage: row.stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    code: row.properties?.code ?? "",
    title: row.properties?.title ?? null,
  };
}

export function mapPushSubscriptionRow(row: any): PushSubscriptionRecord {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    createdAt: row.created_at,
  };
}

export function mapMessageSearchResultRow(row: any): WhatsAppMessageSearchResult {
  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    contactId: row.whatsapp_conversations?.contact_id ?? "",
    contactName: row.whatsapp_conversations?.contacts?.name ?? "Contato removido",
    direction: row.direction,
    body: row.body,
    waTimestamp: row.wa_timestamp,
  };
}

export function mapMessageRow(row: any): WhatsAppMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    waMessageId: row.wa_message_id,
    direction: row.direction,
    messageType: row.message_type,
    body: row.body,
    status: row.status,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    waTimestamp: row.wa_timestamp,
    createdAt: row.created_at,
  };
}
