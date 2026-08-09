import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DataSource } from "../types";
import { mapCorretorRow } from "./mappers";

export const supabaseCorretores: DataSource["corretores"] = {
  async list() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("corretores")
      .select("*")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return (data ?? []).map(mapCorretorRow);
  },

  async getByAuthUserId(authUserId: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("corretores")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCorretorRow(data) : null;
  },
};
