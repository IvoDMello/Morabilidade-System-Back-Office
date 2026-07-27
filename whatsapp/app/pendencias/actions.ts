"use server";

import { revalidatePath } from "next/cache";
import { closeConversation, snoozeFollowUp } from "@/services/whatsapp.service";
import {
  classificarEncerramentos,
  gerarAnalisePendenciasDoDia,
  type PendenciaDoDia,
} from "@/services/ai.service";
import { startOfDaySaoPaulo } from "@/lib/timezone";
import type { ID } from "@/types/common";

export interface AnalisePendenciasResult {
  ok: boolean;
  pendencias: PendenciaDoDia[];
  erro?: string;
}

/** Roda a análise de IA das conversas de hoje sob demanda (botão na aba Pendências). */
export async function analisarPendenciasAction(): Promise<AnalisePendenciasResult> {
  try {
    const pendencias = await gerarAnalisePendenciasDoDia(startOfDaySaoPaulo().toISOString());
    return { ok: true, pendencias };
  } catch (e) {
    const erro =
      e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
        ? "A IA não está configurada (falta ANTHROPIC_API_KEY)."
        : "Não foi possível analisar agora. Tente novamente.";
    return { ok: false, pendencias: [], erro };
  }
}

export interface RevisarEncerramentosResult {
  ok: boolean;
  /** conversationId -> motivo (por que provavelmente não precisa de resposta) */
  encerramentos: Record<string, string>;
  erro?: string;
}

/** IA aponta quais "aguardando resposta" são só encerramento (não pedem resposta). */
export async function revisarEncerramentosAction(): Promise<RevisarEncerramentosResult> {
  try {
    const lista = await classificarEncerramentos();
    const encerramentos: Record<string, string> = {};
    for (const e of lista) encerramentos[e.conversationId] = e.motivo;
    return { ok: true, encerramentos };
  } catch (e) {
    const erro =
      e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
        ? "A IA não está configurada (falta ANTHROPIC_API_KEY)."
        : "Não foi possível revisar agora. Tente novamente.";
    return { ok: false, encerramentos: {}, erro };
  }
}

export async function closeConversationAction(conversationId: ID) {
  await closeConversation(conversationId);
  revalidatePath("/pendencias");
  revalidatePath("/");
}

export async function snoozeFollowUpAction(conversationId: ID) {
  await snoozeFollowUp(conversationId, 1);
  revalidatePath("/pendencias");
}
