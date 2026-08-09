import type { ID } from "@/types/common";
import type {
  AgentProposal,
  CreateAgentProposalInput,
  DecidirAgentProposalInput,
} from "@/types/agent-proposal";
import type { DataSource } from "../types";
import { calcularPlacar } from "../agent-proposal-score";
import { generateId, mockStore } from "./store";

export const mockAgentProposals: DataSource["agentProposals"] = {
  async listPendentesPorContato(contactId: ID) {
    return mockStore.agentProposals
      .filter((p) => p.contactId === contactId && p.status === "pendente")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createMany(inputs: CreateAgentProposalInput[]) {
    const agora = new Date().toISOString();
    const criadas: AgentProposal[] = inputs.map((input) => ({
      id: generateId(),
      conversationId: input.conversationId,
      contactId: input.contactId,
      triggerMessageId: input.triggerMessageId ?? null,
      tool: input.tool,
      args: input.args,
      resumo: input.resumo,
      status: "pendente",
      textoSugerido: input.textoSugerido ?? null,
      textoFinal: null,
      decididoPor: null,
      decididoEm: null,
      modelo: input.modelo ?? null,
      vozHash: input.vozHash ?? null,
      origem: input.origem,
      createdAt: agora,
    }));
    mockStore.agentProposals.push(...criadas);
    return criadas;
  },

  async decidir(id: ID, input: DecidirAgentProposalInput) {
    const proposta = mockStore.agentProposals.find((p) => p.id === id);
    if (!proposta) return;
    proposta.status = input.status;
    proposta.textoFinal = input.textoFinal ?? null;
    proposta.decididoPor = input.decididoPor ?? null;
    proposta.decididoEm = new Date().toISOString();
  },

  async superarPendentes(conversationId: ID) {
    const agora = new Date().toISOString();
    let n = 0;
    for (const p of mockStore.agentProposals) {
      if (p.conversationId !== conversationId || p.status !== "pendente") continue;
      p.status = "superada";
      p.decididoEm = agora;
      n++;
    }
    return n;
  },

  async jaAnalisouMensagem(messageId: ID) {
    return mockStore.agentProposals.some((p) => p.triggerMessageId === messageId);
  },

  async placar() {
    return calcularPlacar(
      mockStore.agentProposals.map((p) => ({
        tool: p.tool,
        status: p.status,
        decididoEm: p.decididoEm,
      })),
    );
  },

  async listEdicoesRecentes(limit = 50) {
    return mockStore.agentProposals
      .filter((p) => p.status === "editada" && p.textoSugerido && p.textoFinal)
      .sort((a, b) => new Date(b.decididoEm ?? 0).getTime() - new Date(a.decididoEm ?? 0).getTime())
      .slice(0, limit)
      .map((p) => ({
        sugerido: p.textoSugerido as string,
        enviado: p.textoFinal as string,
        decididoEm: p.decididoEm as string,
      }));
  },
};
