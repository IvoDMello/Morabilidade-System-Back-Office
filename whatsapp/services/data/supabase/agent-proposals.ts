import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ID } from "@/types/common";
import type {
  CreateAgentProposalInput,
  DecidirAgentProposalInput,
} from "@/types/agent-proposal";
import type { DataSource } from "../types";
import { calcularPlacar, type DecisaoRegistrada } from "../agent-proposal-score";
import { mapAgentProposalRow } from "./mappers";

/** Teto da varredura de métricas — o placar não precisa do histórico inteiro
 * pra ser útil, e uma query sem limite vira problema silencioso com o tempo. */
const MAX_DECISOES_PLACAR = 2000;

export const supabaseAgentProposals: DataSource["agentProposals"] = {
  async listPendentesPorContato(contactId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_proposals")
      .select("*")
      .eq("contact_id", contactId)
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAgentProposalRow);
  },

  async createMany(inputs: CreateAgentProposalInput[]) {
    if (inputs.length === 0) return [];
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_proposals")
      .insert(
        inputs.map((input) => ({
          conversation_id: input.conversationId,
          contact_id: input.contactId,
          trigger_message_id: input.triggerMessageId ?? null,
          tool: input.tool,
          args: input.args,
          resumo: input.resumo,
          texto_sugerido: input.textoSugerido ?? null,
          modelo: input.modelo ?? null,
          voz_hash: input.vozHash ?? null,
          origem: input.origem,
        })),
      )
      .select("*");
    if (error) throw error;
    return (data ?? []).map(mapAgentProposalRow);
  },

  async decidir(id: ID, input: DecidirAgentProposalInput) {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("agent_proposals")
      .update({
        status: input.status,
        texto_final: input.textoFinal ?? null,
        decidido_por: input.decididoPor ?? null,
        decidido_em: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  },

  async superarPendentes(conversationId: ID) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_proposals")
      .update({ status: "superada", decidido_em: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("status", "pendente")
      .select("id");
    if (error) throw error;
    return (data ?? []).length;
  },

  async jaAnalisouMensagem(messageId: ID) {
    const supabase = getSupabaseServerClient();
    const { count, error } = await supabase
      .from("agent_proposals")
      .select("id", { count: "exact", head: true })
      .eq("trigger_message_id", messageId);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async placar() {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_proposals")
      .select("tool, status, decidido_em")
      .in("status", ["aprovada", "editada", "descartada"])
      .order("decidido_em", { ascending: false })
      .limit(MAX_DECISOES_PLACAR);
    if (error) throw error;

    const decisoes: DecisaoRegistrada[] = (data ?? []).map((row) => ({
      tool: row.tool,
      status: row.status,
      decididoEm: row.decidido_em ?? null,
    }));
    return calcularPlacar(decisoes);
  },

  async listEdicoesRecentes(limit = 50) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("agent_proposals")
      .select("texto_sugerido, texto_final, decidido_em")
      .eq("status", "editada")
      .not("texto_sugerido", "is", null)
      .not("texto_final", "is", null)
      .order("decidido_em", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      sugerido: row.texto_sugerido as string,
      enviado: row.texto_final as string,
      decididoEm: row.decidido_em as string,
    }));
  },
};
