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

export const AI_MODEL = "claude-opus-4-8";
