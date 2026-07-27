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
};
