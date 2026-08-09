import { dataSource } from "./data";
import { estimarCustoUSD } from "@/lib/ai-pricing";
import type { ModoAgente } from "./assistant/modo";
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

/**
 * Teto padrão de tokens automáticos por dia (entrada + saída).
 *
 * Contar chamadas não limita gasto: uma análise sobre uma conversa longa custa
 * muitas vezes o que custa uma sobre três mensagens, e as duas contam "1". O
 * teto por token é o que de fato tem relação com a fatura.
 *
 * 2 milhões/dia é folgado de propósito — em Haiku 4.5 dá ~US$ 2/dia no pior
 * caso, em Sonnet 5 ~US$ 6. Não é para apertar a operação; é para que um erro
 * (loop, conversa gigante analisada em rajada) tenha um fim conhecido.
 */
const TETO_PADRAO_TOKENS_DIA = 2_000_000;

const JANELA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Lê o teto do ambiente. `AI_MAX_CHAMADAS_HORA=0` desliga a análise automática
 * por completo — é a válvula de emergência para usar sem redeploy. */
export function getTetoPorHora(): number {
  const bruto = process.env.AI_MAX_CHAMADAS_HORA;
  if (bruto === undefined || bruto.trim() === "") return TETO_PADRAO_POR_HORA;
  const n = Number(bruto);
  // Valor inválido no painel de env não pode virar "sem teto": cai no padrão.
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : TETO_PADRAO_POR_HORA;
}

/** Teto de tokens automáticos por dia. `0` desliga o automático, como o de chamadas. */
export function getTetoTokensDia(): number {
  const bruto = process.env.AI_MAX_TOKENS_DIA;
  if (bruto === undefined || bruto.trim() === "") return TETO_PADRAO_TOKENS_DIA;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : TETO_PADRAO_TOKENS_DIA;
}

export interface VeredictoOrcamento {
  liberado: boolean;
  /** Chamadas automáticas já feitas na última hora. */
  usadas: number;
  teto: number;
  /** Qual teto barrou, quando `liberado` é false. */
  motivo?: "chamadas-hora" | "tokens-dia" | "desligado";
  tokensDia?: number;
  tetoTokensDia?: number;
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
  const tetoTokens = getTetoTokensDia();
  if (teto === 0 || tetoTokens === 0) {
    return { liberado: false, usadas: 0, teto, motivo: "desligado" };
  }

  try {
    const agora = Date.now();
    const [hora, dia] = await Promise.all([
      dataSource.agentRuns.consumoAutomaticoDesde(new Date(agora - JANELA_MS).toISOString()),
      dataSource.agentRuns.consumoAutomaticoDesde(new Date(agora - DIA_MS).toISOString()),
    ]);

    // Tokens de cache entram na conta: leitura é barata, mas não é grátis, e
    // escrita custa mais que entrada normal. Ignorá-los subestimaria o gasto.
    const tokensDia =
      dia.inputTokens + dia.outputTokens + dia.cacheCreationTokens + dia.cacheReadTokens;

    const base = { usadas: hora.chamadas, teto, tokensDia, tetoTokensDia: tetoTokens };
    if (hora.chamadas >= teto) return { ...base, liberado: false, motivo: "chamadas-hora" };
    if (tokensDia >= tetoTokens) return { ...base, liberado: false, motivo: "tokens-dia" };
    return { ...base, liberado: true };
  } catch (erro) {
    console.error("[ai-budget] não foi possível apurar o consumo; liberando:", erro);
    return { liberado: true, usadas: 0, teto };
  }
}

/** Mensagens curtas que nunca contêm endereço, data ou dado de captação —
 * exatamente o que a triagem organizacional procura. */
const SEM_CONTEUDO_ORGANIZACIONAL =
  /^(ok(ay)?|blz|beleza|certo|isso|sim|n[aã]o|obrigad[oa]|obg|vlw|valeu|de nada|bom dia|boa tarde|boa noite|oi|ol[aá]|tchau|at[eé]|perfeito|[👍👌🙏❤️😊✅🤝]+)[\s!.…]*$/i;

/**
 * Decide se vale gastar uma chamada de modelo com esta mensagem.
 *
 * A guarda mais barata do sistema: uma chamada que nunca acontece custa zero, e
 * boa parte do tráfego de WhatsApp é "ok", "obrigado" e figurinha — mensagens em
 * que a triagem organizacional não tem nada a extrair. Antes disto, cada uma
 * delas pagava uma análise completa da conversa.
 *
 * Conservador de propósito: na dúvida, analisa. O custo de analisar à toa é
 * alguns centavos; o de pular uma captação de verdade é uma captação perdida.
 */
export function mensagemMereceAnalise(corpo: string | null, tipo?: string): boolean {
  // Mídia sem legenda: não há texto de onde tirar endereço ou data. A foto do
  // imóvel importa para o humano, não para a extração de dado estruturado.
  if (!corpo || !corpo.trim()) return false;

  // Figurinha e áudio não chegam transcritos — o corpo, quando existe, é rótulo.
  if (tipo === "sticker" || tipo === "audio") return false;

  const limpo = corpo.trim();
  if (SEM_CONTEUDO_ORGANIZACIONAL.test(limpo)) return false;

  return true;
}

/** O que a chamada de modelo devolve sobre o próprio consumo. */
export interface UsoDaChamada {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheCreationTokens?: number | null;
  cacheReadTokens?: number | null;
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
  modo?: ModoAgente;
  conversationId?: string | null;
  uso?: UsoDaChamada | null;
  erro?: string | null;
}): Promise<void> {
  return registrarChamada({
    conversationId: args.conversationId ?? null,
    origem: args.origem,
    recurso: args.recurso,
    modelo: args.modelo,
    modo: args.modo ?? "organizacional",
    inputTokens: args.uso?.inputTokens ?? 0,
    outputTokens: args.uso?.outputTokens ?? 0,
    cacheCreationTokens: args.uso?.cacheCreationTokens ?? 0,
    cacheReadTokens: args.uso?.cacheReadTokens ?? 0,
    erro: args.erro ?? null,
  });
}

/** Consumo automático da última hora — para exibir no painel do agente. */
export function getConsumoDaHora() {
  return dataSource.agentRuns.consumoAutomaticoDesde(
    new Date(Date.now() - JANELA_MS).toISOString(),
  );
}

export interface GastoDoDia {
  chamadas: number;
  tokens: number;
  /** Estimativa em dólares. Null quando algum modelo usado não está na tabela
   * de preços — melhor não mostrar número do que mostrar um errado. */
  custoUSD: number | null;
}

/**
 * Quanto a IA gastou nas últimas 24h, em tokens e em dinheiro.
 *
 * É a pergunta que justifica o livro-razão existir. O custo sai da tabela em
 * `lib/ai-pricing`, aplicada por modelo — misturar modelos numa média daria um
 * número que não corresponde a nada.
 */
export async function getGastoDoDia(): Promise<GastoDoDia> {
  const runs = await dataSource.agentRuns.listRecentes(1000);
  const corte = Date.now() - DIA_MS;

  let tokens = 0;
  let custoUSD: number | null = 0;
  let chamadas = 0;

  for (const run of runs) {
    if (new Date(run.createdAt).getTime() < corte) continue;
    chamadas++;
    tokens +=
      run.inputTokens + run.outputTokens + run.cacheCreationTokens + run.cacheReadTokens;

    const parcial = estimarCustoUSD(run.modelo, run);
    // Um modelo fora da tabela contamina o total: a partir daí não há soma
    // honesta a apresentar.
    if (parcial === null) custoUSD = null;
    else if (custoUSD !== null) custoUSD += parcial;
  }

  return { chamadas, tokens, custoUSD };
}
