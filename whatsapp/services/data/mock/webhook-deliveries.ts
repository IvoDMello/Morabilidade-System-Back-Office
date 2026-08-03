import type { CreateWebhookDeliveryInput, WebhookDelivery } from "@/types/webhook-delivery";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockWebhookDeliveries: DataSource["webhookDeliveries"] = {
  async registrar(input: CreateWebhookDeliveryInput) {
    const registro: WebhookDelivery = {
      id: generateId(),
      motivo: input.motivo,
      eventos: input.eventos ?? 0,
      processados: input.processados ?? 0,
      wamids: input.wamids ?? [],
      erro: input.erro ?? null,
      createdAt: new Date().toISOString(),
    };
    mockStore.webhookDeliveries.push(registro);
  },

  async listRecentes(desdeIso: string, limit = 200) {
    const corte = new Date(desdeIso).getTime();
    return mockStore.webhookDeliveries
      .filter((d) => new Date(d.createdAt).getTime() >= corte)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },
};
