import { getAnthropicClient, AI_MODEL } from "@/lib/anthropic";
import { getContacts } from "@/services/contacts.service";
import { ASSISTANT_TOOLS, type ToolName } from "./tools";

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
