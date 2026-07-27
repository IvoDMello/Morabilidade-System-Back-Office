import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, AI_MODEL } from "@/lib/anthropic";
import { dataSource } from "./data";
import { CONTACT_CATEGORY_LABELS } from "@/constants/contact-categories";
import { CONTACT_STATUS_LABELS } from "@/constants/contact-status";
import type { ID } from "@/types/common";
import type { ContactAiSummary } from "@/types/ai-summary";
import type { WhatsAppMessage } from "@/types/whatsapp";
import type { ContactNote } from "@/types/note";

const summarySchema = z.object({
  objetivo: z.string().describe("Objetivo do cliente — o que ele está buscando"),
  orcamento: z
    .string()
    .describe("Orçamento mencionado ou estimado a partir da conversa; \"Não informado\" se desconhecido"),
  localizacao: z
    .string()
    .describe("Localização/bairro/região de interesse; \"Não informado\" se desconhecido"),
  estagio: z.string().describe("Estágio atual do atendimento, em poucas palavras"),
  proximosPassos: z.string().describe("Próximos passos recomendados, em 1-2 frases"),
});

function buildTranscript(messages: WhatsAppMessage[], limit?: number): string {
  const slice = limit ? messages.slice(-limit) : messages;
  return slice
    .map((m) => `[${m.direction === "inbound" ? "Cliente" : "Corretor"}] ${m.body}`)
    .join("\n");
}

function buildNotesText(notes: ContactNote[], limit?: number): string {
  const slice = limit ? notes.slice(0, limit) : notes;
  return slice.map((n) => `- ${n.note}`).join("\n");
}

async function getContactContext(contactId: ID) {
  const contact = await dataSource.contacts.getById(contactId);
  if (!contact) throw new Error("Contato não encontrado.");

  const conversation = await dataSource.whatsapp.getConversationByContactId(contactId);
  const messages = conversation ? await dataSource.whatsapp.listMessages(conversation.id) : [];
  const notes = await dataSource.notes.listByContact(contactId);

  return { contact, messages, notes };
}

export async function generateConversationSummary(contactId: ID): Promise<ContactAiSummary> {
  const { contact, messages, notes } = await getContactContext(contactId);
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(summarySchema) },
    messages: [
      {
        role: "user",
        content: `Você é um assistente de um corretor de imóveis. Analise a conversa de WhatsApp e as anotações abaixo sobre o contato "${contact.name}" (categoria: ${CONTACT_CATEGORY_LABELS[contact.category]}, status: ${CONTACT_STATUS_LABELS[contact.status]}) e gere um resumo estruturado.

Conversa de WhatsApp:
${buildTranscript(messages) || "(nenhuma mensagem registrada)"}

Anotações do corretor:
${buildNotesText(notes) || "(nenhuma anotação registrada)"}

Se alguma informação não estiver disponível na conversa ou nas anotações, responda "Não informado" para aquele campo — não invente dados.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Não foi possível gerar o resumo.");
  }
  return response.parsed_output;
}

export async function saveConversationSummary(contactId: ID, summary: ContactAiSummary) {
  return dataSource.contacts.update(contactId, {
    aiSummary: summary,
    aiSummaryGeneratedAt: new Date().toISOString(),
  });
}

// ── Análise de pendências do dia (Fase 1 do assistente) ─────────────────────
//
// Lê as conversas com atividade hoje e devolve uma lista estruturada do que
// pode ter passado despercebido: promessas não cumpridas ("te mando as fotos"),
// perguntas do cliente sem resposta, leads novos sem primeiro contato.
// Consumida pelo resumo diário (jobs.service.ts) — best-effort: sem
// ANTHROPIC_API_KEY ou com erro na API, o resumo sai sem a seção de IA.

const pendenciaSchema = z.object({
  pendencias: z
    .array(
      z.object({
        contato: z.string().describe("Nome do contato"),
        motivo: z
          .string()
          .describe("O que ficou pendente, em uma frase curta e acionável"),
        urgencia: z
          .enum(["alta", "media", "baixa"])
          .describe("alta = cliente esperando/promessa não cumprida; media = follow-up recomendado; baixa = pode esperar"),
      }),
    )
    .describe("Pendências reais detectadas nas conversas de hoje; lista vazia se estiver tudo em dia"),
});

export type PendenciaDoDia = z.infer<typeof pendenciaSchema>["pendencias"][number];

const MAX_CONVERSAS_ANALISADAS = 40;
const MAX_MENSAGENS_POR_CONVERSA = 15;

export async function gerarAnalisePendenciasDoDia(
  todayStartIso: string,
): Promise<PendenciaDoDia[]> {
  const conversations = await dataSource.whatsapp.listConversations();
  const ativas = conversations
    .filter((c) => c.lastMessageAt && c.lastMessageAt >= todayStartIso)
    .slice(0, MAX_CONVERSAS_ANALISADAS);

  if (ativas.length === 0) return [];

  const blocos: string[] = [];
  for (const conv of ativas) {
    const messages = await dataSource.whatsapp.listMessages(conv.id);
    const deHoje = messages.filter((m) => m.waTimestamp >= todayStartIso);
    // Mensagens de hoje + um rabo de contexto anterior, pra pendência que
    // nasceu ontem ("te respondo amanhã") ser visível na análise de hoje.
    const janela = deHoje.length > 0 ? deHoje : messages;
    const transcript = buildTranscript(janela, MAX_MENSAGENS_POR_CONVERSA);
    if (!transcript) continue;
    blocos.push(`### ${conv.contactName} (status da conversa: ${conv.status})\n${transcript}`);
  }

  if (blocos.length === 0) return [];

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 2048,
    output_config: { effort: "low", format: zodOutputFormat(pendenciaSchema) },
    messages: [
      {
        role: "user",
        content: `Você é o assistente de um corretor de imóveis. Abaixo estão as conversas de WhatsApp com atividade hoje. Identifique APENAS pendências reais que o corretor pode ter deixado passar:

- promessas feitas pelo corretor e ainda não cumpridas (enviar fotos, verificar disponibilidade, retornar ligação);
- perguntas do cliente que ficaram sem resposta;
- leads novos que ainda não receberam um primeiro atendimento de verdade;
- combinados com data/hora que estão chegando ou passaram.

NÃO liste conversas que estão andando normalmente. Se estiver tudo em dia, devolva a lista vazia. Máximo de 8 pendências, das mais urgentes para as menos.

${blocos.join("\n\n")}`,
      },
    ],
  });

  return response.parsed_output?.pendencias ?? [];
}

// ── Classificação de encerramentos (triagem dos "aguardando resposta") ──────
//
// A aba "aguardando resposta" é mecânica: qualquer conversa cuja última mensagem
// foi do cliente entra ali — inclusive "obrigada!" ou "pode deixar que eu
// retorno", que NÃO pedem resposta. Esta função lê essas conversas e aponta
// quais são só encerramento, para o operador limpar a fila com 1 clique.

const encerramentoSchema = z.object({
  encerramentos: z
    .array(
      z.object({
        conversa: z.string().describe("id EXATO da conversa (o valor após 'id:' no cabeçalho)"),
        motivo: z
          .string()
          .describe("por que não precisa de resposta, em poucas palavras (ex.: agradecimento; cliente disse que retorna)"),
      }),
    )
    .describe("conversas cuja última mensagem do cliente é um encerramento e não pede resposta; vazio se todas precisam"),
});

export async function classificarEncerramentos(): Promise<{ conversationId: ID; motivo: string }[]> {
  const conversations = await dataSource.whatsapp.listConversations();
  const aguardando = conversations.filter((c) => c.status === "aguardando_resposta");
  if (aguardando.length === 0) return [];

  const validIds = new Set(aguardando.map((c) => c.id));
  const blocos: string[] = [];
  for (const conv of aguardando) {
    const messages = await dataSource.whatsapp.listMessages(conv.id);
    const transcript = buildTranscript(messages, 8);
    if (!transcript) continue;
    blocos.push(`### id:${conv.id} — ${conv.contactName}\n${transcript}`);
  }
  if (blocos.length === 0) return [];

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(encerramentoSchema) },
    messages: [
      {
        role: "user",
        content: `Abaixo estão conversas de WhatsApp marcadas como "aguardando resposta" (a última mensagem foi do cliente). Identifique APENAS aquelas cuja última mensagem do cliente é um ENCERRAMENTO que NÃO pede resposta:

- agradecimento ("obrigada!", "valeu");
- o cliente avisa que ele mesmo retorna ("pode deixar que eu retorno", "depois te falo", "qualquer coisa te chamo");
- "ok"/"entendi"/"perfeito" que claramente fecham o assunto.

NÃO inclua conversas em que o cliente fez uma pergunta, pediu algo, ou espera uma ação sua — essas precisam de resposta. Para cada encerramento, devolva o id EXATO da conversa e um motivo curto. Se todas precisam de resposta, devolva a lista vazia.

${blocos.join("\n\n")}`,
      },
    ],
  });

  return (response.parsed_output?.encerramentos ?? [])
    .filter((e) => validIds.has(e.conversa))
    .map((e) => ({ conversationId: e.conversa, motivo: e.motivo }));
}

export async function generateFollowUpSuggestion(contactId: ID): Promise<string> {
  const { contact, messages, notes } = await getContactContext(contactId);
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 512,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `Você é um assistente de um corretor de imóveis. O contato "${contact.name}" (categoria: ${CONTACT_CATEGORY_LABELS[contact.category]}, status: ${CONTACT_STATUS_LABELS[contact.status]}) está sem interação há um tempo. Com base no histórico abaixo, escreva uma mensagem curta, natural e cordial de follow-up para enviar via WhatsApp, em português do Brasil, pronta para envio.

Conversa recente:
${buildTranscript(messages, 10) || "(nenhuma mensagem registrada)"}

Anotações do corretor:
${buildNotesText(notes, 5) || "(nenhuma anotação registrada)"}

Responda apenas com o texto da mensagem, sem aspas e sem comentários adicionais.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Não foi possível gerar a sugestão.");
  }
  return textBlock.text.trim();
}
