import type { AgentRun, CreateAgentRunInput } from "@/types/agent-run";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockAgentRuns: DataSource["agentRuns"] = {
  async registrar(input: CreateAgentRunInput) {
    const run: AgentRun = {
      id: generateId(),
      conversationId: input.conversationId ?? null,
      origem: input.origem,
      recurso: input.recurso,
      modelo: input.modelo,
      modo: input.modo ?? "organizacional",
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      cacheCreationTokens: input.cacheCreationTokens ?? 0,
      cacheReadTokens: input.cacheReadTokens ?? 0,
      erro: input.erro ?? null,
      createdAt: new Date().toISOString(),
    };
    mockStore.agentRuns.push(run);
  },

  async consumoAutomaticoDesde(desdeIso: string) {
    const corte = new Date(desdeIso).getTime();
    return mockStore.agentRuns
      .filter((r) => r.origem !== "painel" && new Date(r.createdAt).getTime() >= corte)
      .reduce(
        (acc, r) => ({
          chamadas: acc.chamadas + 1,
          inputTokens: acc.inputTokens + r.inputTokens,
          outputTokens: acc.outputTokens + r.outputTokens,
          cacheCreationTokens: acc.cacheCreationTokens + r.cacheCreationTokens,
          cacheReadTokens: acc.cacheReadTokens + r.cacheReadTokens,
        }),
        { chamadas: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      );
  },

  async listRecentes(limit = 50) {
    return [...mockStore.agentRuns]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },
};
