import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type {
  ContactFilters,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contact";
import type { DataSource } from "../types";
import { mapContactRow } from "./mappers";

const UNIQUE_VIOLATION = "23505";

function throwFriendly(error: { code?: string; message: string }): never {
  if (error.code === UNIQUE_VIOLATION) {
    throw new Error("Já existe um contato com esse telefone.");
  }
  throw error;
}

export const supabaseContacts: DataSource["contacts"] = {
  async list(filters = {}) {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("contacts")
      .select("*, contact_reminders(id), contact_properties(property_id)");

    if (filters.category) query = query.eq("category", filters.category);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.nextAction) query = query.eq("next_action", filters.nextAction);
    if (filters.isFavorite) query = query.eq("is_favorite", true);
    if (filters.search) {
      const term = filters.search;
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const sortColumn =
      filters.sortBy === "name"
        ? "name"
        : filters.sortBy === "createdAt"
          ? "created_at"
          : "updated_at";
    const ascending = filters.sortDir ? filters.sortDir === "asc" : filters.sortBy === "name";
    query = query.order(sortColumn, { ascending });

    const { data, error } = await query;
    if (error) throw error;

    let rows = data ?? [];
    if (filters.hasReminders) {
      rows = rows.filter((row: { contact_reminders: unknown[] }) => row.contact_reminders?.length > 0);
    }
    if (filters.propertyId) {
      rows = rows.filter((row: { contact_properties: { property_id: string }[] }) =>
        row.contact_properties?.some((cp) => cp.property_id === filters.propertyId),
      );
    }

    return rows.map(mapContactRow);
  },

  async getById(id: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapContactRow(data) : null;
  },

  async findByPhone(phone: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (error) throw error;
    return data ? mapContactRow(data) : null;
  },

  async create(input: CreateContactInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email ?? null,
        category: input.category,
        status: input.status,
        next_action: input.nextAction,
        is_favorite: input.isFavorite ?? false,
        loss_reason: input.lossReason ?? null,
        loss_reason_note: input.lossReasonNote ?? null,
        general_notes: input.generalNotes ?? null,
      })
      .select("*")
      .single();
    if (error) throwFriendly(error);
    return mapContactRow(data);
  },

  async update(id: ID, input: UpdateContactInput) {
    const supabase = getSupabaseServerClient();
    const payload: Record<string, unknown> = {};
    if (input.name !== undefined) payload.name = input.name;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.email !== undefined) payload.email = input.email;
    if (input.category !== undefined) payload.category = input.category;
    if (input.status !== undefined) payload.status = input.status;
    if (input.nextAction !== undefined) payload.next_action = input.nextAction;
    if (input.isFavorite !== undefined) payload.is_favorite = input.isFavorite;
    if (input.isBlocked !== undefined) payload.is_blocked = input.isBlocked;
    if (input.lossReason !== undefined) payload.loss_reason = input.lossReason;
    if (input.lossReasonNote !== undefined) payload.loss_reason_note = input.lossReasonNote;
    if (input.generalNotes !== undefined) payload.general_notes = input.generalNotes;
    if (input.aiSummary !== undefined) payload.ai_summary = input.aiSummary;
    if (input.aiSummaryGeneratedAt !== undefined) {
      payload.ai_summary_generated_at = input.aiSummaryGeneratedAt;
    }

    const { data, error } = await supabase
      .from("contacts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throwFriendly(error);
    return mapContactRow(data);
  },

  async remove(id: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) throw error;
  },
};
