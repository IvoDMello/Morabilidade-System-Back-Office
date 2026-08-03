"use server";

import { revalidatePath } from "next/cache";
import { proporAcoes, type AcaoProposta } from "@/services/assistant";
import { executarAcao, AcaoInvalidaError } from "@/services/assistant/handlers";
import type { ToolName } from "@/services/assistant/tools";

export interface ProporResultado {
  ok: boolean;
  propostas: AcaoProposta[];
  erro?: string;
}

export async function proporAcoesAction(instrucao: string): Promise<ProporResultado> {
  const texto = instrucao.trim();
  if (!texto) return { ok: false, propostas: [], erro: "Descreva o que você quer fazer." };

  try {
    const propostas = await proporAcoes(texto);
    if (propostas.length === 0) {
      return { ok: true, propostas: [], erro: "Não identifiquei nenhuma ação clara no pedido." };
    }
    return { ok: true, propostas };
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
        ? "O assistente de IA não está configurado (falta ANTHROPIC_API_KEY)."
        : "Não foi possível consultar o assistente agora. Tente novamente.";
    return { ok: false, propostas: [], erro: msg };
  }
}

export interface ExecutarResultado {
  ok: boolean;
  message: string;
}

export async function executarAcaoAction(
  tool: ToolName,
  args: Record<string, unknown>,
): Promise<ExecutarResultado> {
  try {
    const message = await executarAcao(tool, args);
    // A ação pode ter criado lembrete/captação — atualiza as telas afetadas.
    revalidatePath("/pendencias");
    revalidatePath("/dashboard");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof AcaoInvalidaError) return { ok: false, message: e.message };
    return { ok: false, message: "Não foi possível concluir a ação." };
  }
}
