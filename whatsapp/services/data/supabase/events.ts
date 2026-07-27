import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type { CreateEventInput } from "@/types/event";
import type { DataSource } from "../types";
import { mapEventRow } from "./mappers";

export const supabaseEvents: DataSource["events"] = {
  async listByContact(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_events")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEventRow);
  },

  async create(input: CreateEventInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_events")
      .insert({
        contact_id: input.contactId,
        type: input.type,
        summary: input.summary,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapEventRow(data);
  },
};
