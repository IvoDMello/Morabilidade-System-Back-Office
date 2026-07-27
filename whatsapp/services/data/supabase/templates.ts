import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type { CreateTemplateInput } from "@/types/template";
import type { DataSource } from "../types";
import { mapTemplateRow } from "./mappers";

export const supabaseTemplates: DataSource["templates"] = {
  async list() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapTemplateRow);
  },

  async create(input: CreateTemplateInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("message_templates")
      .insert({ title: input.title.trim(), body: input.body.trim() })
      .select("*")
      .single();
    if (error) throw error;
    return mapTemplateRow(data);
  },

  async remove(id: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) throw error;
  },
};
