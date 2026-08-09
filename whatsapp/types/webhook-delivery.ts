import type { MotivoRecusa } from "@/lib/webhook-diagnostico";
import type { ID } from "./common";

/** Uma entrega do webhook que foi recusada ou não pôde ser processada.
 * Só existem linhas com problema — ver a migration 0022. */
export interface WebhookDelivery {
  id: ID;
  motivo: MotivoRecusa;
  eventos: number;
  processados: number;
  /** wamids que falharam, quando dá para saber. Numa recusa por assinatura o
   * corpo nem é lido, então vem vazio. */
  wamids: string[];
  erro: string | null;
  createdAt: string;
}

export interface CreateWebhookDeliveryInput {
  motivo: MotivoRecusa;
  eventos?: number;
  processados?: number;
  wamids?: string[];
  erro?: string | null;
}

/** Resumo para o painel: o que aconteceu, quantas vezes e desde quando. */
export interface WebhookFalhaResumo {
  motivo: MotivoRecusa;
  ocorrencias: number;
  /** A mais antiga da janela — é ela que diz há quanto tempo está quebrado. */
  desde: string;
  ultima: string;
}
