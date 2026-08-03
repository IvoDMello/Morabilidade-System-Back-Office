import type { ModoAgente } from "@/services/assistant/modo";
import type { ID } from "./common";

/** De onde a chamada de modelo partiu. O teto de orçamento só barra as
 * automáticas (`webhook`, `cron`) — ver `services/ai-budget.service.ts`. */
export type AgentRunOrigem = "webhook" | "painel" | "cron";

/** Uma chamada de modelo já feita — o registro é sempre posterior ao gasto. */
export interface AgentRun {
  id: ID;
  conversationId: ID | null;
  origem: AgentRunOrigem;
  /** Qual recurso gastou (ex.: "copiloto-conversa", "pendencias-do-dia"). */
  recurso: string;
  modelo: string;
  /** Qual conjunto de ferramentas rodou — separa a triagem barata da completa. */
  modo: ModoAgente;
  inputTokens: number;
  outputTokens: number;
  /** Tokens gravados no cache (custam 25% a mais que entrada normal). */
  cacheCreationTokens: number;
  /** Tokens lidos do cache (custam ~10% de uma entrada normal). Zero por
   * várias rodadas seguidas significa que o prefixo não está sendo reusado. */
  cacheReadTokens: number;
  erro: string | null;
  createdAt: string;
}

export interface CreateAgentRunInput {
  conversationId?: ID | null;
  origem: AgentRunOrigem;
  recurso: string;
  modelo: string;
  modo?: ModoAgente;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  erro?: string | null;
}

/** Consumo agregado de uma janela de tempo. */
export interface AgentRunConsumo {
  chamadas: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}
