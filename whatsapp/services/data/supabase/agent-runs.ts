import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CreateAgentRunInput } from "@/types/agent-run";
import type { DataSource } from "../types";
import { mapAgentRunRow } from "./mappers";

export const supabaseAgentRuns: DataSource["agentRuns"] = {
  async registrar(input: CreateAgentRunInput) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("agent_runs").insert({
      conversation_id: input.conversationId ?? null,
      origem: input.origem,
      recurso: input.recurso,
      modelo: input.modelo,
      modo: input.modo ?? "organizacional",
      input_tokens: input.inputTokens ?? 0,
      output_tokens: input.outputTokens ?? 0,
      cache_creation_tokens: input.cacheCreationTokens ?? 0,
      cache_read_tokens: input.cacheReadTokens ?? 0,
      erro: input.erro ?? null,
    });
    if (error) throw error;
  },

  async consumoAutomaticoDesde(desdeIso: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_runs")
      .select("input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens")
      .in("origem", ["webhook", "cron"])
      .gte("created_at", desdeIso);
    if (error) throw error;

    return (data ?? []).reduce(
      (acc, row) => ({
        chamadas: acc.chamadas + 1,
        inputTokens: acc.inputTokens + (row.input_tokens ?? 0),
        outputTokens: acc.outputTokens + (row.output_tokens ?? 0),
        cacheCreationTokens: acc.cacheCreationTokens + (row.cache_creation_tokens ?? 0),
        cacheReadTokens: acc.cacheReadTokens + (row.cache_read_tokens ?? 0),
      }),
      { chamadas: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
    );
  },

  async listRecentes(limit = 50) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapAgentRunRow);
  },
};
