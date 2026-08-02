import type { ID } from "@/types/common";
import type { ToolName } from "@/services/assistant/tools";

/**
 * Uma ação que o agente propôs, com o desfecho que o humano deu.
 *
 * Serve a dois propósitos que são o mesmo mecanismo visto de dois ângulos:
 * pré-computar (a proposta já espera pronta quando alguém abre a conversa) e
 * aprender a voz (cada desfecho é um exemplo rotulado; a edição é o melhor
 * deles). Ver `supabase/migrations/0020_propostas_agente.sql`.
 */

export type AgentProposalStatus =
  | "pendente"
  | "aprovada"
  | "editada"
  | "descartada"
  | "superada";

/** Como a proposta nasceu: sozinha no webhook, ou porque alguém clicou. */
export type AgentProposalOrigem = "webhook" | "painel";

export interface AgentProposal {
  id: ID;
  conversationId: ID;
  contactId: ID;
  triggerMessageId: ID | null;
  tool: ToolName;
  args: Record<string, unknown>;
  resumo: string;
  status: AgentProposalStatus;
  /** Texto que o agente escreveu (só em `sugerir_resposta`). */
  textoSugerido: string | null;
  /** Texto que de fato foi enviado. Diferente do sugerido => `editada`. */
  textoFinal: string | null;
  decididoPor: string | null;
  decididoEm: string | null;
  modelo: string | null;
  /** Versão do manual de voz vigente na geração — separa "modelo piorou" de "VOZ.md piorou". */
  vozHash: string | null;
  origem: AgentProposalOrigem;
  createdAt: string;
}

export interface CreateAgentProposalInput {
  conversationId: ID;
  contactId: ID;
  triggerMessageId?: ID | null;
  tool: ToolName;
  args: Record<string, unknown>;
  resumo: string;
  textoSugerido?: string | null;
  modelo?: string | null;
  vozHash?: string | null;
  origem: AgentProposalOrigem;
}

export interface DecidirAgentProposalInput {
  status: Exclude<AgentProposalStatus, "pendente">;
  textoFinal?: string | null;
  decididoPor?: string | null;
}

/**
 * Placar de uma ferramenta — a régua para decidir quando um processo pode
 * subir de nível de autonomia. `taxaEdicao` é o número que importa: mede o
 * quanto o humano ainda precisa reescrever o que o agente propôs.
 */
export interface AgentToolScore {
  tool: ToolName;
  /** Decididas (aprovada + editada + descartada). Ignora pendentes e superadas. */
  decididas: number;
  aprovadas: number;
  editadas: number;
  descartadas: number;
  /** editadas / decididas — 0 a 1. `null` quando ainda não há decisão nenhuma. */
  taxaEdicao: number | null;
  /** Aprovações sem edição consecutivas até agora. Zera a cada edição/descarte. */
  sequenciaLimpa: number;
}
