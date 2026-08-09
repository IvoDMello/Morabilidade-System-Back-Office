import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type {
  CreateReminderInput,
  ReminderFilters,
  UpdateReminderInput,
} from "@/types/reminder";
import type { DataSource } from "../types";
import { mapReminderRow, mapReminderWithContactRow } from "./mappers";

export const supabaseReminders: DataSource["reminders"] = {
  async listByContact(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_reminders")
      .select("*")
      .eq("contact_id", contactId)
      .order("reminder_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapReminderRow);
  },

  async listAll(filters: ReminderFilters = {}) {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("contact_reminders")
      .select("*, contacts(name, phone)")
      .order("reminder_at", { ascending: true });

    if (filters.contactId) query = query.eq("contact_id", filters.contactId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query = query.gte("reminder_at", start.toISOString()).lt("reminder_at", end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapReminderWithContactRow);
  },

  async getById(id: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_reminders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapReminderRow(data) : null;
  },

  async create(input: CreateReminderInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_reminders")
      .insert({
        contact_id: input.contactId,
        title: input.title,
        description: input.description ?? null,
        reminder_at: input.reminderAt,
        status: "pendente",
        created_by: input.createdBy,
        corretor_id: input.corretorId ?? null,
        imovel_codigo: input.imovelCodigo ?? null,
        google_calendar_event_id: input.googleCalendarEventId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapReminderRow(data);
  },

  async update(id: ID, input: UpdateReminderInput) {
    const supabase = getSupabaseServerClient();
    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.reminderAt !== undefined) payload.reminder_at = input.reminderAt;
    if (input.status !== undefined) payload.status = input.status;
    if (input.imovelCodigo !== undefined) payload.imovel_codigo = input.imovelCodigo;
    if (input.fichaVisitaId !== undefined) payload.ficha_visita_id = input.fichaVisitaId;
    if (input.fichaNotificadaEm !== undefined) payload.ficha_notificada_em = input.fichaNotificadaEm;

    const { data, error } = await supabase
      .from("contact_reminders")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapReminderRow(data);
  },

  async remove(id: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("contact_reminders").delete().eq("id", id);
    if (error) throw error;
  },

  async listVisitasParaFicha(fromIso: string, toIso: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_reminders")
      .select(
        "id, reminder_at, contact_id, title, imovel_codigo, ficha_visita_id, " +
          "contacts(name, phone, cliente_id), corretores(auth_user_id)",
      )
      .eq("status", "pendente")
      .is("ficha_notificada_em", null)
      .gte("reminder_at", fromIso)
      .lte("reminder_at", toIso)
      .order("reminder_at", { ascending: true });
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- linha crua do Supabase (snake_case + joins)
    return (data ?? []).map((row: any) => ({
      reminderId: row.id,
      reminderAt: row.reminder_at,
      contactId: row.contact_id,
      contactName: row.contacts?.name ?? "",
      contactPhone: row.contacts?.phone ?? "",
      clienteId: row.contacts?.cliente_id ?? null,
      imovelCodigo: row.imovel_codigo ?? null,
      title: row.title ?? "",
      fichaVisitaId: row.ficha_visita_id ?? null,
      corretorAuthUserId: row.corretores?.auth_user_id ?? null,
    }));
  },
};
