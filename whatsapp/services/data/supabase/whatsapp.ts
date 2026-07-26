import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";
import type { ID } from "@/types/common";
import type {
  CreateWhatsAppMessageInput,
  WhatsAppMessageDirection,
} from "@/types/whatsapp";
import type { DataSource } from "../types";
import {
  mapConversationRow,
  mapConversationSummaryRow,
  mapMessageRow,
  mapMessageSearchResultRow,
} from "./mappers";

const UNDEFINED_COLUMN = "42703";

export const supabaseWhatsapp: DataSource["whatsapp"] = {
  async listConversations() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*, contacts(name, phone, is_favorite, is_blocked, contact_tags(tag_id))")
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) {
      // Banco ainda sem a migration 0008 (is_blocked): cai para o select
      // antigo em vez de derrubar o inbox — bloqueio/listas ficam vazios.
      if (error.code !== UNDEFINED_COLUMN) throw error;
      const fallback = await supabase
        .from("whatsapp_conversations")
        .select("*, contacts(name, phone, is_favorite, contact_tags(tag_id))")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map(mapConversationSummaryRow);
    }
    return (data ?? []).map(mapConversationSummaryRow);
  },

  async getConversationByContactId(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapConversationRow(data) : null;
  },

  async getOrCreateConversationForContact(contactId: ID, waPhoneNumber: string) {
    const supabase = getSupabaseServerClient();

    const { data: existingRow, error: findError } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("contact_id", contactId)
      .maybeSingle();
    if (findError) throw findError;
    if (existingRow) return mapConversationRow(existingRow);

    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .insert({ contact_id: contactId, wa_phone_number: waPhoneNumber })
      .select("*")
      .single();
    if (error) throw error;
    return mapConversationRow(data);
  },

  async listMessages(conversationId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("wa_timestamp", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapMessageRow);
  },

  async searchMessages(query: string, limit = 50) {
    const supabase = getSupabaseServerClient();
    // Escapa curingas do LIKE para buscar o texto literal digitado.
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*, whatsapp_conversations!inner(contact_id, contacts(name))")
      .ilike("body", pattern)
      .order("wa_timestamp", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapMessageSearchResultRow);
  },

  async createMessage(input: CreateWhatsAppMessageInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .insert({
        conversation_id: input.conversationId,
        wa_message_id: input.waMessageId ?? null,
        direction: input.direction,
        message_type: input.messageType ?? "text",
        body: input.body,
        status: input.status,
        created_by: input.createdBy ?? null,
        wa_timestamp: input.waTimestamp,
      })
      .select("*")
      .single();
    if (error) {
      // 23505 = unique_violation no índice de wa_message_id: entrega duplicada
      // da Meta que passou pelo check prévio (retry concorrente). Idempotência:
      // devolve a mensagem já gravada em vez de estourar 500 no webhook.
      if (error.code === "23505" && input.waMessageId) {
        const { data: existing } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("wa_message_id", input.waMessageId)
          .single();
        if (existing) return mapMessageRow(existing);
      }
      throw error;
    }
    return mapMessageRow(data);
  },

  async findMessageByWaId(waMessageId: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("wa_message_id", waMessageId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapMessageRow(data) : null;
  },

  async updateMessageStatus(
    waMessageId: string,
    status: WhatsAppMessageStatus,
    errorMessage: string | null = null,
  ) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .update({ status, error_message: errorMessage })
      .eq("wa_message_id", waMessageId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapMessageRow(data) : null;
  },

  async touchConversationOnNewMessage(
    conversationId: ID,
    preview: string,
    timestampIso: string,
    direction: WhatsAppMessageDirection,
  ) {
    const supabase = getSupabaseServerClient();
    if (direction === "inbound") {
      const { data: current, error: readError } = await supabase
        .from("whatsapp_conversations")
        .select("unread_count")
        .eq("id", conversationId)
        .single();
      if (readError) throw readError;

      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: timestampIso,
          last_message_preview: preview,
          last_message_direction: direction,
          unread_count: (current?.unread_count ?? 0) + 1,
        })
        .eq("id", conversationId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: timestampIso,
        last_message_preview: preview,
        last_message_direction: direction,
      })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async markConversationRead(conversationId: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async setConversationPinned(conversationId: ID, pinnedAt: string | null) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ pinned_at: pinnedAt })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async markConversationUnread(conversationId: ID) {
    const supabase = getSupabaseServerClient();
    // Marca manualmente como não lida sem inflar a contagem real: se já havia
    // mensagens não lidas, mantém; senão vira 1 (o badge do WhatsApp).
    const { data: current, error: readError } = await supabase
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .single();
    if (readError) throw readError;
    if ((current?.unread_count ?? 0) > 0) return;

    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 1 })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async clearConversation(conversationId: ID) {
    const supabase = getSupabaseServerClient();
    const { error: deleteError } = await supabase
      .from("whatsapp_messages")
      .delete()
      .eq("conversation_id", conversationId);
    if (deleteError) throw deleteError;

    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({
        last_message_at: null,
        last_message_preview: null,
        last_message_direction: null,
        unread_count: 0,
      })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async countUnreadConversations() {
    const supabase = getSupabaseServerClient();
    const { count, error } = await supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .gt("unread_count", 0);
    if (error) throw error;
    return count ?? 0;
  },

  async countByStatus(status) {
    const supabase = getSupabaseServerClient();
    const { count, error } = await supabase
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    if (error) throw error;
    return count ?? 0;
  },

  async closeConversation(conversationId: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ status: "encerrada", status_changed_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async snoozeFollowUp(conversationId: ID, untilIso: string) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ follow_up_snoozed_until: untilIso })
      .eq("id", conversationId);
    if (error) throw error;
  },

  async markStaleRespondidasAsFollowUp(cutoffIso: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .update({ status: "follow_up_sugerido", status_changed_at: new Date().toISOString() })
      .eq("status", "respondida")
      .lte("last_inbound_at", cutoffIso)
      .select("id");
    if (error) throw error;
    return (data ?? []).length;
  },

  async listOverdueAwaiting(alertCutoffIso: string, todayStartIso: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*, contacts(name, phone, is_favorite, is_blocked, contact_tags(tag_id))")
      .eq("status", "aguardando_resposta")
      .lte("last_inbound_at", alertCutoffIso)
      .or(`last_alert_at.is.null,last_alert_at.lt.${todayStartIso}`);
    if (error) throw error;
    return (data ?? []).map(mapConversationSummaryRow);
  },

  async markAlerted(conversationId: ID, whenIso: string) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("whatsapp_conversations")
      .update({ last_alert_at: whenIso })
      .eq("id", conversationId);
    if (error) throw error;
  },
};
