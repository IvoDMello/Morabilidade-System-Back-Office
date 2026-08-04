import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, AI_MODEL, getModeloParaModo } from "@/lib/anthropic";
import { getModoAgente, permiteSugerirResposta, type ModoAgente } from "./modo";
import { getContacts, getContactById } from "@/services/contacts.service";
import { getConversationMessages } from "@/services/whatsapp.service";
import { listCaptacoesDoTelefone, type CaptacaoResumo } from "@/services/captacoes.service";
import { ASSISTANT_TOOLS, SUGERIR_RESPOSTA_TOOL, type ToolName } from "./tools";
import { getVoz } from "./voz";

const MAX_CONTATOS_CONTEXTO = 200;

/** Uma ação proposta pelo assistente, aguardando confirmação humana. */
export interface AcaoProposta {
  tool: ToolName;
  args: Record<string, unknown>;
  /** Frase legível do que será feito, para o operador conferir antes de confirmar. */
  resumo: string;
}

const dataFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function resumirAcao(
  tool: ToolName,
  args: Record<string, unknown>,
  nomePorId: Map<string, string>,
): string {
  if (tool === "agendar_visita") {
    const nome = nomePorId.get(String(args.contato_id)) ?? "contato";
    let quando = String(args.data_hora ?? "");
    // A data vem como local SP "YYYY-MM-DDTHH:mm"; formata sem reinterpretar fuso.
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(quando);
    if (m) quando = `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
    const imovel = args.imovel_codigo ? ` no imóvel ${args.imovel_codigo}` : "";
    return `Agendar visita com ${nome} em ${quando}${imovel}.`;
  }
  if (tool === "criar_captacao") {
    const partes = [String(args.endereco ?? "")];
    if (args.quartos) partes.push(`${args.quartos} quarto(s)`);
    const proprietario = args.proprietario_nome ?? args.contato_proprietario;
    if (proprietario) partes.push(`proprietário ${proprietario}`);
    return `Criar captação: ${partes.filter(Boolean).join(" · ")}.`;
  }
  if (tool === "sugerir_resposta") {
    const nome = nomePorId.get(String(args.contato_id)) ?? "o contato";
    return `Enviar resposta para ${nome}.`;
  }
  return "Ação proposta.";
}

/**
 * Fase 2 — passo PROPOR: manda a instrução do operador para o modelo com as
 * ferramentas disponíveis e devolve as ações propostas (tool_use). NÃO executa
 * nada: a execução só acontece depois da confirmação humana (ver handlers.ts).
 * Best-effort de contexto: passa a lista de contatos para o modelo poder
 * referenciar contato_id.
 */
export async function proporAcoes(instrucao: string): Promise<AcaoProposta[]> {
  const contatos = (await getContacts()).slice(0, MAX_CONTATOS_CONTEXTO);
  const nomePorId = new Map(contatos.map((c) => [c.id, c.name]));
  const listaContatos = contatos
    .map((c) => `- ${c.id} · ${c.name} · ${c.phone}`)
    .join("\n");

  const agoraSP = dataFmt.format(new Date());
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    tools: ASSISTANT_TOOLS,
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Você é o assistente operacional de um corretor de imóveis. A partir do pedido abaixo, proponha as ações apropriadas usando as ferramentas. Não invente dados que não estejam no pedido. Se faltar informação essencial (ex.: sem data para uma visita), não proponha a ação.

Agora em São Paulo: ${agoraSP}.

Contatos cadastrados (use o id exato ao referenciar um contato):
${listaContatos || "(nenhum contato)"}

Pedido do operador:
${instrucao}`,
      },
    ],
  });

  const propostas: AcaoProposta[] = [];
  for (const bloco of response.content) {
    if (bloco.type !== "tool_use") continue;
    const tool = bloco.name as ToolName;
    const args = (bloco.input ?? {}) as Record<string, unknown>;
    propostas.push({ tool, args, resumo: resumirAcao(tool, args, nomePorId) });
  }
  return propostas;
}

/** Quanto histórico entra no prompt.
 *
 * O organizacional lê menos de propósito: ele extrai fato estruturado (endereço,
 * quartos, uma data combinada), e isso está nas mensagens recentes. Ler 60
 * mensagens para achar um endereço é pagar entrada por contexto que não muda a
 * proposta. O completo precisa de mais porque escrever exige saber o que já foi
 * dito, para não repetir pergunta. */
const MAX_MENSAGENS_CONTEXTO: Record<ModoAgente, number> = {
  organizacional: 20,
  completo: 60,
};

function descreverCaptacao(c: CaptacaoResumo): string {
  const partes = [c.endereco, c.statusLabel];
  if (c.quartos) partes.push(`${c.quartos} quarto(s)`);
  return partes.join(" · ");
}

/** Resultado da análise, com o rastro de como ela foi produzida. Modelo e
 * versão do manual de voz ficam gravados em cada proposta — sem isso, quando a
 * qualidade cair, não dá pra saber se mexeram no VOZ.md ou se o modelo mudou. */
export interface AnaliseDaConversa {
  propostas: AcaoProposta[];
  modelo: string;
  vozHash: string;
  modo: ModoAgente;
  /** Tokens que esta análise consumiu, para o livro-razão de custo. Quem chama
   * é que grava, porque só lá se sabe a conversa e a origem (ver
   * `services/ai-budget.service.ts`). */
  uso: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  } | null;
}

/** Instrução de processo do modo organizacional. Estática de propósito: é ela
 * que forma o prefixo cacheável do prompt (ver `montarSystem`). */
const PROCESSO_ORGANIZACIONAL = `Você é o assistente de organização de uma imobiliária (Morabilidade). Sua função é MANTER O CRM EM DIA a partir do que já foi dito na conversa — você não fala com o cliente e não escreve mensagens.

Proponha ações apenas com o que está EXPLÍCITO na conversa. Nunca invente, complete ou deduza dado que o cliente não disse.

Quando um proprietário estiver oferecendo um imóvel:
- Assim que houver ao menos o ENDEREÇO, proponha criar_captacao com tudo que já foi dito (endereço, quartos, banheiros, portaria), com o nome do contato em proprietario_nome e o telefone dele em proprietario_whatsapp.
- Faltando o endereço, não proponha nada: uma captação sem endereço não serve para ninguém.

Quando ficar combinada uma visita com DATA e HORA claras, proponha agendar_visita.

Se não houver nada a organizar, não proponha ferramenta nenhuma. Não propor é a resposta certa na maioria das conversas — não force uma ação para parecer útil.`;

/** Instrução de processo do modo completo (inclui redigir para o cliente). */
const PROCESSO_COMPLETO = `Você é o copiloto de atendimento de uma imobiliária (Morabilidade). Analise a conversa de WhatsApp e proponha ações usando as ferramentas. Nunca invente dados que não estejam na conversa.

Processo de captação (quando o contato é um proprietário oferecendo um imóvel):
1. Coletar: endereço completo, quartos, banheiros, tipo de portaria, e pedir fotos.
2. Assim que houver ao menos o endereço, proponha criar_captacao com tudo que já foi dito (nome do contato em proprietario_nome, telefone dele em proprietario_whatsapp).
3. Se ainda faltar informação, proponha sugerir_resposta com UMA mensagem cordial pedindo só o que falta (não repita o que já foi respondido).
4. Se o cliente pedir/combinar uma visita com data e hora claras, proponha agendar_visita.

Se a conversa não for de captação, ainda assim proponha sugerir_resposta quando houver algo útil a responder. Se não houver nada a fazer, não proponha ferramenta nenhuma.`;

/**
 * Monta o bloco `system` — a parte ESTÁVEL do prompt, marcada para cache.
 *
 * A separação system/messages não é estética: o cache da Anthropic é casamento
 * de prefixo, então tudo que varia por chamada (agora, contato, histórico)
 * precisa vir DEPOIS do ponto de corte, senão invalida o prefixo inteiro e o
 * cache nunca é lido. O relógio, em particular, mudava a cada minuto no meio do
 * prompt antigo — sozinho, isso já impedia qualquer reaproveitamento.
 *
 * Vale registrar a ressalva: o prefixo só entra em cache acima de um mínimo
 * (1.024 tokens no Sonnet, 4.096 no Haiku). O modo organizacional, sem o manual
 * de voz, pode ficar abaixo disso — e aí não cacheia e a API não avisa. Por isso
 * `cache_read_tokens` é medido no livro-razão: a resposta é observar, não supor.
 */
function montarSystem(modo: ModoAgente, vozTexto: string): Anthropic.TextBlockParam[] {
  const blocos: string[] = [
    modo === "completo" ? PROCESSO_COMPLETO : PROCESSO_ORGANIZACIONAL,
  ];

  // O manual de voz só governa COMO escrever. Sem sugerir_resposta ele não tem
  // função — e seriam ~1.500 tokens de entrada em cada chamada.
  if (modo === "completo") {
    blocos.push(
      `=== MANUAL DE VOZ (como escrever) ===\nToda mensagem que você propuser em sugerir_resposta precisa seguir o manual abaixo. Ele foi escrito pela equipe que atende e vale mais que qualquer instinto seu de estilo.\n\n${vozTexto}\n=== FIM DO MANUAL DE VOZ ===`,
    );
  }

  return blocos.map((text, i) => ({
    type: "text" as const,
    text,
    // Marca só o último bloco: o cache cobre tudo que vem antes dele.
    ...(i === blocos.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

/**
 * Copiloto da CONVERSA: analisa o histórico do WhatsApp com o contato e propõe
 * ações — criar captação com os dados que o proprietário já passou, agendar
 * visita e/ou sugerir a próxima resposta. O modelo só PROPÕE; nada executa sem
 * confirmação humana (handlers.ts), e a resposta sugerida pode ser editada
 * antes do envio.
 *
 * O jeito de escrever vem de `VOZ.md` (ver ./voz.ts), não daqui: quem ajusta o
 * tom é quem atende. Este prompt cuida do *processo*; o manual cuida da *voz*.
 */
export async function proporAcoesDaConversa(
  contactId: string,
  opcoes?: { modo?: ModoAgente },
): Promise<AnaliseDaConversa> {
  const modo = opcoes?.modo ?? getModoAgente();
  const modelo = getModeloParaModo(modo);
  const voz = getVoz();
  const vazio: AnaliseDaConversa = {
    propostas: [],
    modelo,
    vozHash: voz.hash,
    modo,
    uso: null,
  };

  const contato = await getContactById(contactId);
  if (!contato) return vazio;

  const [mensagens, captacoes] = await Promise.all([
    getConversationMessages(contactId),
    listCaptacoesDoTelefone(contato.phone).catch(() => [] as CaptacaoResumo[]),
  ]);

  const historico = mensagens
    .slice(-MAX_MENSAGENS_CONTEXTO[modo])
    .map((m) => `${m.direction === "inbound" ? "Cliente" : "Nós"}: ${m.body || `[${m.messageType}]`}`)
    .join("\n");

  const captacoesExistentes = captacoes.length
    ? captacoes.map((c) => `- ${descreverCaptacao(c)}`).join("\n")
    : "(nenhuma captação vinculada a este telefone)";

  const nomePorId = new Map([[contato.id, contato.name]]);
  const client = getAnthropicClient();

  const ferramentas = permiteSugerirResposta(modo)
    ? [...ASSISTANT_TOOLS, SUGERIR_RESPOSTA_TOOL]
    : ASSISTANT_TOOLS;

  const response = await client.messages.create({
    model: modelo,
    // O organizacional só devolve argumentos de ferramenta (endereço, data) —
    // não precisa de espaço para redigir. Teto menor é teto de gasto.
    max_tokens: modo === "completo" ? 1536 : 512,
    system: montarSystem(modo, voz.texto),
    tools: ferramentas,
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        // Tudo aqui varia por chamada e por isso fica DEPOIS do system cacheado.
        // O relógio em especial: no prompt antigo ele vinha antes das instruções
        // e invalidava o prefixo a cada minuto.
        content: `Agora em São Paulo: ${dataFmt.format(new Date())}.

Contato desta conversa (use exatamente este id):
- ${contato.id} · ${contato.name} · ${contato.phone} · categoria: ${contato.category}

Captações já existentes ligadas a este telefone (não crie duplicada):
${captacoesExistentes}

Conversa (mais antiga primeiro):
${historico || "(sem mensagens)"}`,
      },
    ],
  });

  const propostas: AcaoProposta[] = [];
  for (const bloco of response.content) {
    if (bloco.type !== "tool_use") continue;
    const tool = bloco.name as ToolName;
    const args = (bloco.input ?? {}) as Record<string, unknown>;
    // Cinto de segurança: mesmo sem a ferramenta na lista, uma proposta de texto
    // que escape do modelo não pode virar proposta no modo organizacional.
    if (tool === "sugerir_resposta" && !permiteSugerirResposta(modo)) continue;
    // O modelo às vezes esquece o contato_id em sugerir_resposta — é sempre o da conversa.
    if (tool === "sugerir_resposta" && !args.contato_id) args.contato_id = contato.id;
    propostas.push({ tool, args, resumo: resumirAcao(tool, args, nomePorId) });
  }
  return {
    propostas,
    modelo,
    vozHash: voz.hash,
    modo,
    uso: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}
