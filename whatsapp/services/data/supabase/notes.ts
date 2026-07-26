import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type { CreateNoteInput } from "@/types/note";
import type { DataSource } from "../types";
import { mapNoteRow } from "./mappers";

export const supabaseNotes: DataSource["notes"] = {
  async listByContact(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_notes")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapNoteRow);
  },

  async create(input: CreateNoteInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: input.contactId,
        note: input.note,
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapNoteRow(data);
  },
};
