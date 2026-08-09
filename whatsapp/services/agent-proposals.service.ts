import { dataSource } from "./data";
import { getContactByPhone } from "./contacts.service";
import { proporAcoesDaConversa } from "./assistant";
import { dentroDoOrcamento, mensagemMereceAnalise, registrarUso } from "./ai-budget.service";
import { getModoAgente } from "./assistant/modo";
import { atingiuMeta, META_GRADUACAO } from "./data/agent-proposal-score";
import type { ID } from "@/types/common";
import type {
  AgentProposal,
  AgentProposalOrigem,
  AgentToolScore,
  CreateAgentProposalInput,
} from "@/types/agent-proposal";

/**
 * Nível 1 do agente: "chegar antes do humano".
 *
 * A análise deixa de ser um botão e passa a rodar quando a mensagem chega. O
 * resultado fica guardado, então quem abre a conversa já encontra o rascunho
 * pronto em vez de esperar. Nada disso executa sozinho: proposta continua sendo
 * proposta até alguém confirmar (ver `assistant/handlers.ts`).
 *
 * O mesmo registro que serve à pré-computação serve à coleta de voz — cada
 * desfecho é um exemplo rotulado, e uma edição guarda o par (sugerido, enviado).
 */

/** Só o texto de `sugerir_resposta` vira exemplo de voz; as outras ferramentas
 * são dados estruturados, não escrita. */
function textoSugeridoDe(tool: string, args: Record<string, unknown>): string | null {
  if (tool !== "sugerir_resposta") return null;
  const texto = args.texto;
  return typeof texto === "string" ? texto : null;
}

export interface AnalisarEGuardarInput {
  contactId: ID;
  /** Mensagem recebida que disparou a análise. Ausente quando veio do painel. */
  triggerMessageId?: ID | null;
  origem: AgentProposalOrigem;
}

/**
 * Analisa a conversa e guarda as propostas. Devolve o que ficou pendente.
 *
 * Quatro guardas, nesta ordem — todas existem para não gastar chamada de modelo
 * à toa nem encher a tela de proposta velha:
 *
 *  1. **Dedupe** — a mesma mensagem recebida nunca é analisada duas vezes
 *     (a Meta reentrega webhooks).
 *  2. **Rajada** — se o cliente mandou três mensagens seguidas, só a última
 *     vale a análise; as anteriores desistem sozinhas em vez de disputarem.
 *  3. **Orçamento** — o caminho automático respeita um teto por hora. O painel
 *     nunca é barrado: quem clicou tem intenção (ver `ai-budget.service.ts`).
 *  4. **Supersessão** — propostas pendentes da conversa viram `superada` antes
 *     das novas entrarem, senão o painel mostraria conselho sobre um assunto
 *     que já mudou.
 */
export async function analisarEGuardar(
  input: AnalisarEGuardarInput,
): Promise<AgentProposal[]> {
  const conversa = await dataSource.whatsapp.getConversationByContactId(input.contactId);
  if (!conversa) return [];

  if (input.triggerMessageId) {
    if (await dataSource.agentProposals.jaAnalisouMensagem(input.triggerMessageId)) return [];

    // Guarda de rajada: só analisamos se esta ainda é a última mensagem do
    // cliente. Se já chegou outra, ela traz o contexto completo e o webhook
    // dela é que vai analisar — desistir aqui é mais barato que competir.
    const mensagens = await dataSource.whatsapp.listMessages(conversa.id);
    const ultimaInbound = [...mensagens].reverse().find((m) => m.direction === "inbound");
    if (ultimaInbound && ultimaInbound.id !== input.triggerMessageId) return [];

    // Guarda de conteúdo: "ok", "obrigado" e figurinha não têm o que organizar.
    // A chamada que não acontece é a mais barata de todas, e boa parte do
    // tráfego de WhatsApp é exatamente isso. Só no caminho automático — quem
    // clicou no painel quer a análise mesmo de uma conversa curta.
    if (
      input.origem !== "painel" &&
      ultimaInbound &&
      !mensagemMereceAnalise(ultimaInbound.body, ultimaInbound.messageType)
    ) {
      return [];
    }
  }

  // O teto vale só para quem não tem gente esperando do outro lado.
  if (input.origem !== "painel") {
    const orcamento = await dentroDoOrcamento();
    if (!orcamento.liberado) {
      console.warn(
        `[agent-proposals] orçamento de IA esgotado (${orcamento.motivo}: ` +
          `${orcamento.usadas}/${orcamento.teto} chamadas/h, ` +
          `${orcamento.tokensDia ?? 0}/${orcamento.tetoTokensDia ?? 0} tokens/dia); ` +
          "análise automática pulada — a conversa segue na fila e o botão do painel continua valendo.",
      );
      return [];
    }
  }

  // O caminho automático é sempre organizacional: o agente arruma o CRM, não
  // escreve para o cliente. O painel respeita o modo configurado.
  const modo = input.origem === "painel" ? getModoAgente() : "organizacional";
  const analise = await proporAcoesDaConversa(input.contactId, { modo });

  // Registra o gasto ANTES de decidir se houve proposta: uma análise que não
  // propôs nada custou exatamente o mesmo que uma que propôs três.
  await registrarUso({
    // AgentProposalOrigem ("webhook" | "painel") é subconjunto de AgentRunOrigem.
    origem: input.origem,
    recurso: "copiloto-conversa",
    modelo: analise.modelo,
    modo: analise.modo,
    conversationId: conversa.id,
    uso: analise.uso,
  });

  if (analise.propostas.length === 0) return [];

  await dataSource.agentProposals.superarPendentes(conversa.id);

  const inputs: CreateAgentProposalInput[] = analise.propostas.map((p) => ({
    conversationId: conversa.id,
    contactId: input.contactId,
    triggerMessageId: input.triggerMessageId ?? null,
    tool: p.tool,
    args: p.args,
    resumo: p.resumo,
    textoSugerido: textoSugeridoDe(p.tool, p.args),
    modelo: analise.modelo,
    vozHash: analise.vozHash,
    origem: input.origem,
  }));

  return dataSource.agentProposals.createMany(inputs);
}

/**
 * Entrada do webhook: analisa a conversa do telefone que acabou de escrever.
 *
 * Best-effort por contrato — a mensagem do cliente já está gravada, e nenhuma
 * falha de IA (chave ausente, timeout, quota) pode virar erro visível. Devolve
 * lista vazia em vez de lançar.
 */
export async function analisarConversaDoTelefone(
  phone: string,
  triggerMessageId: ID,
): Promise<AgentProposal[]> {
  try {
    const contato = await getContactByPhone(phone);
    if (!contato) return [];
    return await analisarEGuardar({
      contactId: contato.id,
      triggerMessageId,
      origem: "webhook",
    });
  } catch (erro) {
    console.error("[agent-proposals] análise automática falhou:", erro);
    return [];
  }
}

/** O que o painel mostra ao abrir a conversa — já pronto, sem esperar. */
export function listPropostasPendentes(contactId: ID): Promise<AgentProposal[]> {
  return dataSource.agentProposals.listPendentesPorContato(contactId);
}

export interface RegistrarDesfechoInput {
  propostaId: ID;
  /** Texto que de fato saiu. Se diferir do sugerido, o desfecho vira `editada`. */
  textoFinal?: string | null;
  textoSugerido?: string | null;
  decididoPor?: string | null;
}

/**
 * Marca uma proposta como confirmada. Compara o texto enviado com o sugerido
 * para separar `aprovada` de `editada` — é essa distinção que alimenta o
 * aprendizado de voz, então ela é feita aqui e não confiada à interface.
 */
export async function registrarConfirmacao(input: RegistrarDesfechoInput): Promise<void> {
  const sugerido = (input.textoSugerido ?? "").trim();
  const final = (input.textoFinal ?? "").trim();
  const houveEdicao = sugerido.length > 0 && final.length > 0 && sugerido !== final;

  await dataSource.agentProposals.decidir(input.propostaId, {
    status: houveEdicao ? "editada" : "aprovada",
    textoFinal: input.textoFinal ?? null,
    decididoPor: input.decididoPor ?? null,
  });
}

export async function registrarDescarte(propostaId: ID, decididoPor?: string | null) {
  await dataSource.agentProposals.decidir(propostaId, {
    status: "descartada",
    decididoPor: decididoPor ?? null,
  });
}

export interface PlacarDoAgente {
  scores: (AgentToolScore & { atingiuMeta: boolean })[];
  meta: typeof META_GRADUACAO;
}

/**
 * Placar de graduação por ferramenta. É **indicador, não gatilho**: nada no
 * sistema muda de comportamento por causa destes números. Quem promove um
 * processo para mais autonomia é gente, olhando o placar e decidindo.
 */
export async function getPlacar(): Promise<PlacarDoAgente> {
  const scores = await dataSource.agentProposals.placar();
  return {
    scores: scores.map((s) => ({ ...s, atingiuMeta: atingiuMeta(s) })),
    meta: META_GRADUACAO,
  };
}

/** Pares (sugerido, enviado) das respostas que a equipe reescreveu — a
 * matéria-prima para atualizar o `VOZ.md` com o que eles de fato dizem. */
export function listEdicoesParaVoz(limit = 50) {
  return dataSource.agentProposals.listEdicoesRecentes(limit);
}
