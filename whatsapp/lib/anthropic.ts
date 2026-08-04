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

/** Lê uma variável de ambiente tratando vazio como ausente.
 *
 * `??` sozinho não serve aqui: uma linha `AI_MODEL=` no .env deixa a variável
 * como string vazia, não `undefined`, e o fallback nunca acontece. O modelo ia
 * vazio para a API e a resposta era um 400 ("model: String should have at least
 * 1 character") — que o catch das actions traduzia para "não foi possível
 * consultar o assistente". Como o `.env.local.example` traz `AI_MODEL=` sem
 * valor, todo ambiente novo copiava a armadilha junto. */
function envOu(nome: string, padrao: string): string {
  return process.env[nome]?.trim() || padrao;
}

// Modelo dos recursos de IA. Sonnet 5 é o padrão: dá conta das tarefas do CRM
// (pendências, resumo, follow-up, propor ação) com ótimo custo-benefício. Para
// trocar sem mexer no código, defina AI_MODEL no ambiente (ex.: na Vercel):
//   claude-opus-5    → qualidade máxima (US$ 5 / US$ 25 por milhão de tokens)
//   claude-sonnet-5  → padrão, equilibrado (US$ 3 / US$ 15)
//   claude-haiku-4-5 → mais barato/rápido (US$ 1 / US$ 5)
export const AI_MODEL = envOu("AI_MODEL", "claude-sonnet-5");

/**
 * Modelo da TRIAGEM organizacional — o caminho de alto volume.
 *
 * Existe separado porque as duas cargas não se parecem. A triagem extrai fato
 * estruturado de uma conversa curta ("tem endereço? tem data?"), que é
 * exatamente o trabalho em que o modelo mais barato empata com o caro. Quem
 * roda por clique é outra história: é raro, tem gente esperando, e ali a
 * qualidade vale mais que a diferença de preço.
 *
 * **Padrão deliberado: cai em AI_MODEL, ou seja, nada muda sozinho.** Trocar o
 * modelo é decisão de quem opera, não efeito colateral de um deploy — mas a
 * conta é direta: em Haiku 4.5 a triagem custa **um terço** do que custa em
 * Sonnet 5, na entrada e na saída. Para adotar, defina no ambiente:
 *   AI_MODEL_TRIAGEM=claude-haiku-4-5
 *
 * Uma ressalva ao trocar: o mínimo para o prompt entrar em cache é maior no
 * Haiku (4.096 tokens contra 1.024 no Sonnet). O prompt organizacional é curto
 * e provavelmente fica abaixo dos dois — por isso o livro-razão mede
 * `cache_read_tokens` em vez de supor economia (ver migration 0021).
 */
export const AI_MODEL_TRIAGEM = envOu("AI_MODEL_TRIAGEM", AI_MODEL);

/** Modelo a usar conforme o papel da chamada. */
export function getModeloParaModo(modo: "organizacional" | "completo"): string {
  return modo === "organizacional" ? AI_MODEL_TRIAGEM : AI_MODEL;
}
