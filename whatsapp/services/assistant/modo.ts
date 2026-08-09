/**
 * Papel do agente — o que ele tem permissão de propor.
 *
 * Decisão de 2026-08-03: **o papel do agente é organizacional.** Ele arruma a
 * casa (captação com os dados que o proprietário já deu, visita que ficou
 * combinada) e não redige resposta a cliente, nem como rascunho para alguém
 * conferir. O atendimento em si continua sendo de gente.
 *
 * As duas razões pesam na mesma direção:
 *  1. **Produto** — texto para cliente é a parte com risco de CRECI e de tom;
 *     não é onde se começa a confiar num agente.
 *  2. **Custo** — é também a parte cara. Redigir exige o manual de voz inteiro
 *     no prompt (~1.500 tokens de entrada em TODA chamada) e devolve um texto
 *     completo na saída, que é o token mais caro que existe. Cortar isso é a
 *     maior economia disponível sem tocar em modelo nem em volume.
 *
 * `completo` existe para quando a operação decidir promover — a régua é o
 * placar em /pendencias, não o calendário. Ativar é uma variável de ambiente.
 */

export type ModoAgente = "organizacional" | "completo";

const PADRAO: ModoAgente = "organizacional";

/**
 * Lê o modo do ambiente. Qualquer valor não reconhecido cai no padrão
 * organizacional — o modo mais restrito e mais barato é o que deve vencer
 * quando alguém digita errado no painel de env.
 */
export function getModoAgente(): ModoAgente {
  return process.env.AGENTE_MODO?.trim().toLowerCase() === "completo"
    ? "completo"
    : PADRAO;
}

/** True se este modo pode propor texto para o cliente. */
export function permiteSugerirResposta(modo: ModoAgente): boolean {
  return modo === "completo";
}
