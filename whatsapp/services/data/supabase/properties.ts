import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type { CreatePropertyInput } from "@/types/property";
import type { PropertyStage } from "@/constants/property-stages";
import type { PropertyRelation } from "@/constants/property-relations";
import type { DataSource } from "../types";
import { mapContactPropertyRow, mapPropertyRow } from "./mappers";

export const supabaseProperties: DataSource["properties"] = {
  async list() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("properties").select("*").order("code");
    if (error) throw error;
    return (data ?? []).map(mapPropertyRow);
  },

  async findByCode(code: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .ilike("code", code.trim())
      .maybeSingle();
    if (error) throw error;
    return data ? mapPropertyRow(data) : null;
  },

  async create(input: CreatePropertyInput) {
    const supabase = getSupabaseServerClient();
    const code = input.code.trim();

    const { data: existing, error: findError } = await supabase
      .from("properties")
      .select("*")
      .ilike("code", code)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return mapPropertyRow(existing);

    const { data, error } = await supabase
      .from("properties")
      .insert({ code, title: input.title ?? null })
      .select("*")
      .single();
    if (error) throw error;
    return mapPropertyRow(data);
  },

  async listByContact(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_properties")
      .select("*, properties(code, title)")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapContactPropertyRow);
  },

  async addToContact(
    contactId: ID,
    propertyId: ID,
    relacao: PropertyRelation,
    stage: PropertyStage,
  ) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("contact_properties")
      .upsert(
        { contact_id: contactId, property_id: propertyId, relacao, stage },
        { onConflict: "contact_id,property_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  },

  async updateStage(contactId: ID, propertyId: ID, stage: PropertyStage) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("contact_properties")
      .update({ stage })
      .eq("contact_id", contactId)
      .eq("property_id", propertyId);
    if (error) throw error;
  },

  async updateRelacao(contactId: ID, propertyId: ID, relacao: PropertyRelation) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("contact_properties")
      .update({ relacao })
      .eq("contact_id", contactId)
      .eq("property_id", propertyId);
    if (error) throw error;
  },

  async removeFromContact(contactId: ID, propertyId: ID) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("contact_properties")
      .delete()
      .eq("contact_id", contactId)
      .eq("property_id", propertyId);
    if (error) throw error;
  },
};
