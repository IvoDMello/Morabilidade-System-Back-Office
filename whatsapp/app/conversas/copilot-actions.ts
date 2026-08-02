"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { proporAcoesDaConversa, type AcaoProposta } from "@/services/assistant";
import { executarAcao, AcaoInvalidaError } from "@/services/assistant/handlers";
import type { ToolName } from "@/services/assistant/tools";
import { criarCaptacao, type CaptacaoResumo } from "@/services/captacoes.service";

/**
 * Server actions do copiloto DENTRO da conversa. Mesmo contrato do /assistente
 * (propor → confirmação humana → executar), mas com o contexto do contato e
 * revalidação da tela de conversa (uma resposta enviada precisa aparecer na
 * thread na hora).
 */

export interface AnaliseResultado {
  ok: boolean;
  propostas: AcaoProposta[];
  erro?: string;
}

export async function analisarConversaAction(contactId: string): Promise<AnaliseResultado> {
  try {
    const propostas = await proporAcoesDaConversa(contactId);
    if (propostas.length === 0) {
      return { ok: true, propostas: [], erro: "Nenhuma ação sugerida para esta conversa agora." };
    }
    return { ok: true, propostas };
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
        ? "O copiloto de IA não está configurado (falta ANTHROPIC_API_KEY)."
        : "Não foi possível analisar a conversa agora. Tente novamente.";
    return { ok: false, propostas: [], erro: msg };
  }
}

export interface ExecutarConversaResultado {
  ok: boolean;
  message: string;
}

export async function executarAcaoDaConversaAction(
  contactId: string,
  tool: ToolName,
  args: Record<string, unknown>,
): Promise<ExecutarConversaResultado> {
  try {
    const message = await executarAcao(tool, args);
    revalidatePath("/");
    revalidatePath(`/contatos/${contactId}`);
    revalidatePath("/lembretes");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof AcaoInvalidaError) return { ok: false, message: e.message };
    return { ok: false, message: "Não foi possível concluir a ação." };
  }
}

const captacaoFormSchema = z.object({
  endereco: z.string().trim().min(3, "Informe o endereço do imóvel."),
  quartos: z.number().int().min(0).max(50).nullable().optional(),
  banheiros: z.number().int().min(0).max(50).nullable().optional(),
  tipoPortaria: z.string().trim().max(120).optional(),
  contatoProprietario: z.string().trim().max(200).optional(),
  observacoes: z.string().trim().max(2000).optional(),
});
export type CaptacaoFormValues = z.infer<typeof captacaoFormSchema>;

export interface CriarCaptacaoResultado {
  ok: boolean;
  message: string;
  captacao?: CaptacaoResumo;
}

/** Criação manual (formulário do painel) — sem IA no meio do caminho. */
export async function criarCaptacaoDaConversaAction(
  values: CaptacaoFormValues,
): Promise<CriarCaptacaoResultado> {
  const parsed = captacaoFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const captacao = await criarCaptacao(parsed.data);
    return { ok: true, message: `Captação criada para "${captacao.endereco}".`, captacao };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não foi possível criar a captação." };
  }
}
