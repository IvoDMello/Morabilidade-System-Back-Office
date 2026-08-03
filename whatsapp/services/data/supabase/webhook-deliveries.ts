import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CreateWebhookDeliveryInput, WebhookDelivery } from "@/types/webhook-delivery";
import type { DataSource } from "../types";

function mapRow(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: String(row.id),
    motivo: row.motivo as WebhookDelivery["motivo"],
    eventos: (row.eventos as number) ?? 0,
    processados: (row.processados as number) ?? 0,
    wamids: (row.wamids as string[]) ?? [],
    erro: (row.erro as string) ?? null,
    createdAt: String(row.created_at),
  };
}

export const supabaseWebhookDeliveries: DataSource["webhookDeliveries"] = {
  async registrar(input: CreateWebhookDeliveryInput) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("webhook_deliveries").insert({
      motivo: input.motivo,
      eventos: input.eventos ?? 0,
      processados: input.processados ?? 0,
      wamids: input.wamids ?? [],
      erro: input.erro ?? null,
    });
    if (error) throw error;
  },

  async listRecentes(desdeIso: string, limit = 200) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .gte("created_at", desdeIso)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
};
