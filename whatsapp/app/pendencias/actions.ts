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

export interface AnaliseIaResult {
  ok: boolean;
  /** O que pode ter passado hoje — promessas, perguntas sem resposta, leads. */
  pendencias: PendenciaDoDia[];
  /** conversationId -> motivo (por que provavelmente não precisa de resposta) */
  encerramentos: Record<string, string>;
  erro?: string;
}

function mensagemDeErro(e: unknown, verbo: string): string {
  return e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
    ? "A IA não está configurada (falta ANTHROPIC_API_KEY)."
    : `Não foi possível ${verbo} agora. Tente novamente.`;
}

/**
 * Passada única da IA sobre a fila. Antes eram dois botões ("Analisar" e
 * "Revisar") que liam as mesmas conversas e respondiam à mesma pergunta —
 * agora um clique traz as duas leituras: o que faltou fazer hoje e quais
 * "aguardando resposta" são só encerramento.
 *
 * As duas rodam em paralelo e falham de forma independente: se uma cair, a
 * outra ainda aparece, com o aviso do que não veio.
 */
export async function analisarComIaAction(): Promise<AnaliseIaResult> {
  const [analise, revisao] = await Promise.allSettled([
    gerarAnalisePendenciasDoDia(startOfDaySaoPaulo().toISOString()),
    classificarEncerramentos(),
  ]);

  const encerramentos: Record<string, string> = {};
  if (revisao.status === "fulfilled") {
    for (const e of revisao.value) encerramentos[e.conversationId] = e.motivo;
  }

  const erros: string[] = [];
  if (analise.status === "rejected") erros.push(mensagemDeErro(analise.reason, "analisar"));
  if (revisao.status === "rejected") erros.push(mensagemDeErro(revisao.reason, "revisar"));

  return {
    ok: analise.status === "fulfilled" || revisao.status === "fulfilled",
    pendencias: analise.status === "fulfilled" ? analise.value : [],
    encerramentos,
    // Se as duas falharam pelo mesmo motivo (API key), não repete a frase.
    erro: erros.length > 0 ? [...new Set(erros)].join(" ") : undefined,
  };
}

export async function closeConversationAction(conversationId: ID) {
  await closeConversation(conversationId);
  revalidatePath("/pendencias");
  revalidatePath("/");
  // "Conversas aguardando" da visão geral sai daqui; a página é
  // pré-renderizada, então precisa ser avisada.
  revalidatePath("/dashboard");
}

export async function snoozeFollowUpAction(conversationId: ID) {
  await snoozeFollowUp(conversationId, 1);
  revalidatePath("/pendencias");
  revalidatePath("/dashboard");
}
