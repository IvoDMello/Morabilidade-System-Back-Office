import { dataSource } from "./data";
import type { AgentRunOrigem, CreateAgentRunInput } from "@/types/agent-run";

/**
 * Teto de gasto do caminho automático da IA.
 *
 * O problema que isto resolve: desde a 0020 a análise dispara sozinha quando a
 * mensagem chega. O gatilho passou a ser **o cliente digitando**, que é
 * justamente a variável que não controlamos. Uma conversa em rajada, um
 * disparo de campanha ou uma reentrega em massa da Meta viram custo direto,
 * sem ninguém no meio para perceber.
 *
 * A regra tem duas metades, e a segunda importa tanto quanto a primeira:
 *
 *  1. O caminho **automático** (webhook, cron) respeita um teto por hora.
 *     Estourou, a análise não roda — a mensagem continua gravada, a conversa
 *     continua na fila, e quem abrir a conversa ainda pode clicar. Perde-se a
 *     antecipação, não o atendimento.
 *  2. O caminho do **painel nunca é barrado**. Quem clicou tem intenção
 *     explícita, e recusar isso custa mais em confiança do que a chamada custa
 *     em dinheiro. Um humano bloqueado abandona a ferramenta; um agente
 *     bloqueado só volta na próxima mensagem.
 *
 * O teto é por hora corrida (janela deslizante), não por dia: um pico às 9h não
 * pode deixar a operação sem copiloto às 15h.
 */

/** Teto padrão de chamadas automáticas por hora. Dimensionado para caber o pico
 * plausível de um dia de atendimento (~1 mensagem/minuto sustentada) e ainda
 * assim barrar um loop de reentrega, que é a falha que queremos conter. */
const TETO_PADRAO_POR_HORA = 60;

const JANELA_MS = 60 * 60 * 1000;

/** Lê o teto do ambiente. `AI_MAX_CHAMADAS_HORA=0` desliga a análise automática
 * por completo — é a válvula de emergência para usar sem redeploy. */
export function getTetoPorHora(): number {
  const bruto = process.env.AI_MAX_CHAMADAS_HORA;
  if (bruto === undefined || bruto.trim() === "") return TETO_PADRAO_POR_HORA;
  const n = Number(bruto);
  // Valor inválido no painel de env não pode virar "sem teto": cai no padrão.
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : TETO_PADRAO_POR_HORA;
}

export interface VeredictoOrcamento {
  liberado: boolean;
  /** Chamadas automáticas já feitas na última hora. */
  usadas: number;
  teto: number;
}

/**
 * Decide se uma chamada automática pode gastar agora.
 *
 * Falha ABERTA de propósito: se a contagem não puder ser lida (tabela ausente
 * porque a 0021 ainda não rodou, Supabase instável), liberamos. O teto existe
 * para conter excesso, e negar o recurso principal por causa de uma consulta de
 * contabilidade seria trocar um problema de custo por um de produto.
 */
export async function dentroDoOrcamento(): Promise<VeredictoOrcamento> {
  const teto = getTetoPorHora();
  if (teto === 0) return { liberado: false, usadas: 0, teto };

  try {
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const consumo = await dataSource.agentRuns.consumoAutomaticoDesde(desde);
    return { liberado: consumo.chamadas < teto, usadas: consumo.chamadas, teto };
  } catch (erro) {
    console.error("[ai-budget] não foi possível apurar o consumo; liberando:", erro);
    return { liberado: true, usadas: 0, teto };
  }
}

/** O que a chamada de modelo devolve sobre o próprio consumo. */
export interface UsoDaChamada {
  inputTokens?: number | null;
  outputTokens?: number | null;
}

/**
 * Registra uma chamada já feita. Best-effort por contrato: o gasto aconteceu de
 * qualquer jeito, e falhar a escrita do registro não pode desfazer nem
 * invalidar o resultado que o usuário está esperando.
 */
export async function registrarChamada(input: CreateAgentRunInput): Promise<void> {
  try {
    await dataSource.agentRuns.registrar(input);
  } catch (erro) {
    console.error("[ai-budget] falha ao registrar a chamada:", erro);
  }
}

/** Açúcar para o caso comum: registrar a partir do `usage` da resposta. */
export function registrarUso(args: {
  origem: AgentRunOrigem;
  recurso: string;
  modelo: string;
  conversationId?: string | null;
  uso?: UsoDaChamada | null;
  erro?: string | null;
}): Promise<void> {
  return registrarChamada({
    conversationId: args.conversationId ?? null,
    origem: args.origem,
    recurso: args.recurso,
    modelo: args.modelo,
    inputTokens: args.uso?.inputTokens ?? 0,
    outputTokens: args.uso?.outputTokens ?? 0,
    erro: args.erro ?? null,
  });
}

/** Consumo automático da última hora — para exibir no painel do agente. */
export function getConsumoDaHora() {
  return dataSource.agentRuns.consumoAutomaticoDesde(
    new Date(Date.now() - JANELA_MS).toISOString(),
  );
}
