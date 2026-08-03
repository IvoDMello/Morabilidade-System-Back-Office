"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { executarAcao, AcaoInvalidaError } from "@/services/assistant/handlers";
import type { ToolName } from "@/services/assistant/tools";
import { criarCaptacao, type CaptacaoResumo } from "@/services/captacoes.service";
import { getCurrentUserName } from "@/services/corretores.service";
import {
  analisarEGuardar,
  registrarConfirmacao,
  registrarDescarte,
} from "@/services/agent-proposals.service";
import type { AgentProposal } from "@/types/agent-proposal";

/**
 * Server actions do copiloto DENTRO da conversa. Mesmo contrato de sempre
 * (propor → confirmação humana → executar), agora com as propostas guardadas:
 * elas sobrevivem ao fechamento do painel, e cada desfecho vira exemplo
 * rotulado para o manual de voz (ver `services/agent-proposals.service.ts`).
 */

export interface AnaliseResultado {
  ok: boolean;
  propostas: AgentProposal[];
  erro?: string;
}

/** Análise sob demanda — o botão continua existindo para quando a pessoa quer
 * reanalisar depois de responder algo à mão. O caminho normal agora é a
 * proposta já estar pronta, pré-computada quando a mensagem chegou. */
export async function analisarConversaAction(contactId: string): Promise<AnaliseResultado> {
  try {
    const propostas = await analisarEGuardar({ contactId, origem: "painel" });
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

/**
 * Executa uma proposta confirmada e registra o desfecho.
 *
 * `textoSugerido` é o que o agente escreveu; `args.texto` é o que o operador
 * decidiu enviar. Diferentes => a proposta é marcada como `editada` e o par
 * vira matéria-prima do `VOZ.md`. O registro é best-effort: falhar em anotar
 * estatística nunca pode desfazer uma ação que já aconteceu de verdade.
 */
export async function executarAcaoDaConversaAction(
  contactId: string,
  tool: ToolName,
  args: Record<string, unknown>,
  propostaId?: string,
  textoSugerido?: string | null,
): Promise<ExecutarConversaResultado> {
  try {
    const message = await executarAcao(tool, args);

    if (propostaId) {
      const textoFinal = typeof args.texto === "string" ? args.texto : null;
      await registrarConfirmacao({
        propostaId,
        textoFinal,
        textoSugerido: textoSugerido ?? null,
        decididoPor: await getCurrentUserName(),
      }).catch((erro) => {
        console.error("[copiloto] não foi possível registrar o desfecho:", erro);
      });
    }

    revalidatePath("/");
    revalidatePath(`/contatos/${contactId}`);
    revalidatePath("/pendencias");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof AcaoInvalidaError) return { ok: false, message: e.message };
    return { ok: false, message: "Não foi possível concluir a ação." };
  }
}

/** Dispensar também é sinal: registra que o agente propôs algo que não servia. */
export async function dispensarPropostaAction(propostaId: string): Promise<void> {
  try {
    await registrarDescarte(propostaId, await getCurrentUserName());
    revalidatePath("/");
  } catch (erro) {
    console.error("[copiloto] não foi possível registrar o descarte:", erro);
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
