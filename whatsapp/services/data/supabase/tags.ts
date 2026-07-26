import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type { CreateTagInput } from "@/types/tag";
import type { DataSource } from "../types";
import { mapTagRow } from "./mappers";

export const supabaseTags: DataSource["tags"] = {
  async list() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("tags").select("*").order("name");
    if (error) throw error;
    return (data ?? []).map(mapTagRow);
  },

  async create(input: CreateTagInput) {
    const supabase = getSupabaseServerClient();
    const name = input.name.trim();

    const { data: existing, error: findError } = await supabase
      .from("tags")
      .select("*")
      .ilike("name", name)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return mapTagRow(existing);

    const { data, error } = await supabase
      .from("tags")
      .insert({ name, color: input.color ?? "slate" })
      .select("*")
      .single();
    if (error) throw error;
    return mapTagRow(data);
  },

  async listByContact(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_tags")
      .select("tags(*)")
      .eq("contact_id", contactId);
    if (error) throw error;
    return (data ?? [])
      .map((row: { tags: unknown }) => row.tags)
      .filter(Boolean)
      .map(mapTagRow);
  },

  async addToContact(contactId: ID, tagId: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("contact_tags")
      .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: "contact_id,tag_id" });
    if (error) throw error;
  },

  async removeFromContact(contactId: ID, tagId: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("contact_tags")
      .delete()
      .eq("contact_id", contactId)
      .eq("tag_id", tagId);
    if (error) throw error;
  },
};
