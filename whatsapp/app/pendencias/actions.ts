"use server";

import { revalidatePath } from "next/cache";
import { closeConversation, snoozeFollowUp } from "@/services/whatsapp.service";
import { gerarAnalisePendenciasDoDia, type PendenciaDoDia } from "@/services/ai.service";
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

export async function closeConversationAction(conversationId: ID) {
  await closeConversation(conversationId);
  revalidatePath("/pendencias");
  revalidatePath("/");
}

export async function snoozeFollowUpAction(conversationId: ID) {
  await snoozeFollowUp(conversationId, 1);
  revalidatePath("/pendencias");
}
