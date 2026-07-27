import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Cliente Anthropic para uso em Server Actions / Server Components.
 * Lê ANTHROPIC_API_KEY do ambiente — nenhuma outra configuração necessária. */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY não configurada. Defina essa variável no .env.local para usar os recursos de IA.",
      );
    }
    client = new Anthropic();
  }
  return client;
}

// Modelo dos recursos de IA. Sonnet 5 é o padrão: dá conta das tarefas do CRM
// (pendências, resumo, follow-up, propor ação) com ótimo custo-benefício. Para
// trocar sem mexer no código, defina AI_MODEL no ambiente (ex.: na Vercel):
//   claude-opus-4-8  → qualidade máxima (mais caro)
//   claude-sonnet-5  → padrão, equilibrado
//   claude-haiku-4-5 → mais barato/rápido, para os recursos mais simples
export const AI_MODEL = process.env.AI_MODEL ?? "claude-sonnet-5";
