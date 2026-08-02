import { getAnthropicClient, AI_MODEL } from "@/lib/anthropic";
import { getContacts, getContactById } from "@/services/contacts.service";
import { getConversationMessages } from "@/services/whatsapp.service";
import { listCaptacoesDoTelefone, type CaptacaoResumo } from "@/services/captacoes.service";
import { ASSISTANT_TOOLS, SUGERIR_RESPOSTA_TOOL, type ToolName } from "./tools";

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
    if (args.contato_proprietario) partes.push(`contato ${args.contato_proprietario}`);
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

const MAX_MENSAGENS_CONTEXTO = 60;

function descreverCaptacao(c: CaptacaoResumo): string {
  const partes = [c.endereco, c.statusLabel];
  if (c.quartos) partes.push(`${c.quartos} quarto(s)`);
  return partes.join(" · ");
}

/**
 * Copiloto da CONVERSA (fase captações): analisa o histórico do WhatsApp com o
 * contato e propõe ações — criar captação com os dados que o proprietário já
 * passou, agendar visita e/ou sugerir a próxima resposta. Mesmo contrato do
 * /assistente: o modelo só PROPÕE; nada executa sem confirmação humana
 * (handlers.ts), e a resposta sugerida pode ser editada antes do envio.
 */
export async function proporAcoesDaConversa(contactId: string): Promise<AcaoProposta[]> {
  const contato = await getContactById(contactId);
  if (!contato) return [];

  const [mensagens, captacoes] = await Promise.all([
    getConversationMessages(contactId),
    listCaptacoesDoTelefone(contato.phone).catch(() => [] as CaptacaoResumo[]),
  ]);

  const historico = mensagens
    .slice(-MAX_MENSAGENS_CONTEXTO)
    .map((m) => `${m.direction === "inbound" ? "Cliente" : "Nós"}: ${m.body || `[${m.messageType}]`}`)
    .join("\n");

  const captacoesExistentes = captacoes.length
    ? captacoes.map((c) => `- ${descreverCaptacao(c)}`).join("\n")
    : "(nenhuma captação vinculada a este telefone)";

  const nomePorId = new Map([[contato.id, contato.name]]);
  const agoraSP = dataFmt.format(new Date());
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1536,
    tools: [...ASSISTANT_TOOLS, SUGERIR_RESPOSTA_TOOL],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Você é o copiloto de atendimento de uma imobiliária (Morabilidade). Analise a conversa de WhatsApp abaixo e proponha ações usando as ferramentas. Nunca invente dados que não estejam na conversa.

Processo de captação (quando o contato é um proprietário oferecendo um imóvel):
1. Coletar: endereço completo, quartos, banheiros, tipo de portaria, e pedir fotos.
2. Assim que houver ao menos o endereço, proponha criar_captacao com tudo que já foi dito (inclua o telefone do contato em contato_proprietario).
3. Se ainda faltar informação, proponha sugerir_resposta com UMA mensagem cordial pedindo só o que falta (não repita o que já foi respondido).
4. Se o cliente pedir/combinar uma visita com data e hora claras, proponha agendar_visita.

Se a conversa não for de captação, ainda assim proponha sugerir_resposta quando houver algo útil a responder. Se não houver nada a fazer, não proponha ferramenta nenhuma.

Agora em São Paulo: ${agoraSP}.

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
    // O modelo às vezes esquece o contato_id em sugerir_resposta — é sempre o da conversa.
    if (tool === "sugerir_resposta" && !args.contato_id) args.contato_id = contato.id;
    propostas.push({ tool, args, resumo: resumirAcao(tool, args, nomePorId) });
  }
  return propostas;
}
