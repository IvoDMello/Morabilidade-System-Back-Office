import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CreatePushSubscriptionInput } from "@/types/push";
import type { DataSource } from "../types";
import { mapPushSubscriptionRow } from "./mappers";

export const supabasePushSubscriptions: DataSource["pushSubscriptions"] = {
  async list() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from("push_subscriptions").select("*");
    if (error) throw error;
    return (data ?? []).map(mapPushSubscriptionRow);
  },

  async upsert(input: CreatePushSubscriptionInput) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
        { onConflict: "endpoint" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return mapPushSubscriptionRow(data);
  },

  async remove(endpoint: string) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
  },
};
