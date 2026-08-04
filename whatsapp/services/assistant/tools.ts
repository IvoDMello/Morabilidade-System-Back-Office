import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Ferramentas que o assistente pode PROPOR (fase 2). O modelo nunca executa
 * nada: ele só emite tool_use, que viram propostas mostradas para confirmação
 * humana. A validação de verdade (inclusive o range permitido de horário) mora
 * nos handlers, nunca no modelo — ver handlers.ts.
 */

// ── agendar_visita ───────────────────────────────────────────────────────────

/** Range permitido para uma visita (horário local America/Sao_Paulo). */
export const VISITA_RANGE = {
  horaMin: 8, // 08:00
  horaMax: 19, // até 19:00 (início da visita)
  diasAdiante: 60, // no máximo 60 dias à frente
  permiteDomingo: false,
};

export const agendarVisitaArgs = z.object({
  contato_id: z.string().describe("id do contato (da lista fornecida) para quem a visita será agendada"),
  data_hora: z
    .string()
    .describe(
      "data e hora da visita em horário local de São Paulo, formato YYYY-MM-DDTHH:mm (ex.: 2026-07-28T15:00). Sem fuso/offset.",
    ),
  imovel_codigo: z
    .string()
    .optional()
    .describe("código do imóvel da visita, se houver (ex.: MB-00033)"),
  observacao: z.string().optional().describe("observação curta opcional sobre a visita"),
});
export type AgendarVisitaArgs = z.infer<typeof agendarVisitaArgs>;

// ── criar_captacao ───────────────────────────────────────────────────────────

export const criarCaptacaoArgs = z.object({
  endereco: z.string().describe("endereço do imóvel a captar (obrigatório)"),
  quartos: z.number().int().optional().describe("número de quartos, se mencionado"),
  banheiros: z.number().int().optional().describe("número de banheiros, se mencionado"),
  tipo_portaria: z.string().optional().describe("tipo de portaria (ex.: 24h, eletrônica), se mencionado"),
  proprietario_nome: z.string().optional().describe("nome do proprietário"),
  proprietario_whatsapp: z.string().optional().describe("WhatsApp do proprietário"),
  /** Legado: propostas gravadas antes da separação nome/WhatsApp guardaram os
   * dois num campo livre só. Continua aceito para que uma proposta pendente
   * antiga ainda possa ser confirmada (ver handlers.ts). */
  contato_proprietario: z.string().optional(),
  observacoes: z.string().optional().describe("observações livres relevantes para a captação"),
});
export type CriarCaptacaoArgs = z.infer<typeof criarCaptacaoArgs>;

// ── sugerir_resposta ─────────────────────────────────────────────────────────

export const sugerirRespostaArgs = z.object({
  contato_id: z.string().describe("id do contato que receberá a resposta"),
  texto: z.string().min(1).describe("texto da mensagem sugerida, pronto para enviar via WhatsApp"),
});
export type SugerirRespostaArgs = z.infer<typeof sugerirRespostaArgs>;

// ── Registro ─────────────────────────────────────────────────────────────────

export type ToolName = "agendar_visita" | "criar_captacao" | "sugerir_resposta";

/**
 * Ferramentas ORGANIZACIONAIS: as que arrumam a casa sem falar com o cliente.
 *
 * A separação existe porque o papel do agente hoje é organizacional. Ele não
 * redige resposta a cliente no caminho automático — nem como rascunho. Isso é
 * decisão de produto (o time quer o WhatsApp na mão de gente por enquanto) e
 * corta custo de tabela: sem `sugerir_resposta` o manual de voz não precisa
 * entrar no prompt, e a saída deixa de carregar um texto inteiro.
 */
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "agendar_visita",
    description:
      "Agenda uma visita a um imóvel com um contato, criando um lembrete. Use quando o operador quer marcar/agendar uma visita. A visita precisa estar dentro do horário comercial; se o pedido estiver fora do range, ainda assim proponha — a validação final é do sistema.",
    input_schema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "id do contato (da lista fornecida)" },
        data_hora: {
          type: "string",
          description:
            "data e hora local de São Paulo, formato YYYY-MM-DDTHH:mm, sem fuso (ex.: 2026-07-28T15:00)",
        },
        imovel_codigo: { type: "string", description: "código do imóvel, se houver (ex.: MB-00033)" },
        observacao: { type: "string", description: "observação curta opcional" },
      },
      required: ["contato_id", "data_hora"],
    },
  },
  {
    name: "criar_captacao",
    description:
      "Cria uma nova captação (lead de imóvel a captar) no board de captações. Use quando o operador quer cadastrar/registrar uma captação nova. Só o endereço é obrigatório.",
    input_schema: {
      type: "object",
      properties: {
        endereco: { type: "string", description: "endereço do imóvel (obrigatório)" },
        quartos: { type: "integer", description: "número de quartos, se mencionado" },
        banheiros: { type: "integer", description: "número de banheiros, se mencionado" },
        tipo_portaria: { type: "string", description: "tipo de portaria, se mencionado" },
        proprietario_nome: { type: "string", description: "nome do proprietário, se souber" },
        proprietario_whatsapp: {
          type: "string",
          description: "WhatsApp do proprietário — normalmente o telefone do próprio contato da conversa",
        },
        observacoes: { type: "string", description: "observações livres" },
      },
      required: ["endereco"],
    },
  },
];

/** Ferramenta extra do copiloto de conversa: propor uma resposta ao cliente.
 * Só entra no fluxo da conversa (nunca no /assistente solto) porque a resposta
 * precisa de um destinatário concreto — e o envio só acontece após confirmação
 * (e possível edição) do operador. */
export const SUGERIR_RESPOSTA_TOOL: Anthropic.Tool = {
  name: "sugerir_resposta",
  description:
    "Sugere o texto da próxima mensagem a enviar ao cliente nesta conversa de WhatsApp. Use sempre que houver algo útil a responder — especialmente para conduzir o processo de captação com um proprietário (pedir endereço, quartos, banheiros, portaria, fotos, documentação). O texto será revisado por um humano antes do envio.",
  input_schema: {
    type: "object",
    properties: {
      contato_id: { type: "string", description: "id do contato desta conversa" },
      texto: { type: "string", description: "mensagem pronta para enviar, em português, tom cordial e direto" },
    },
    required: ["contato_id", "texto"],
  },
};
