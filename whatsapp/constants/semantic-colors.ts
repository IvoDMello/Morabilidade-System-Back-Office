/**
 * Paleta semântica única do produto (tema escuro).
 *
 * Antes desta camada, categoria/status/próxima ação/etapa de imóvel definiam
 * cada um o próprio dicionário de hex — o que gerava contradições (a mesma
 * palavra com cores diferentes) e colisões (dois estágios distintos do funil
 * com a mesma cor). Agora existe uma só paleta de papéis, e todos os
 * dicionários mapeiam para ela. Regra: um significado = uma cor.
 *
 * O chip é um véu translúcido da matiz sobre o fundo (`rgba(matiz, 0.14)`)
 * com o texto num token que troca de valor entre tema claro e escuro.
 */

export type SemanticTone =
  | "info"
  | "success"
  | "waiting"
  | "progress"
  | "attention"
  | "danger"
  | "neutral"
  | "faded";

/** Classes Tailwind (véu translúcido + texto em token de tema) para badges/chips por papel. */
export const SEMANTIC_TONES: Record<SemanticTone, string> = {
  info: "bg-[rgba(91,155,213,0.14)] text-sky",
  success: "bg-[rgba(126,196,145,0.14)] text-jade-soft",
  waiting: "bg-[rgba(216,203,106,0.14)] text-gold",
  progress: "bg-[rgba(139,127,212,0.14)] text-lilac",
  attention: "bg-[rgba(212,127,168,0.14)] text-blush",
  danger: "bg-[rgba(196,85,62,0.14)] text-ember",
  neutral: "bg-veil/6 text-ink-mid",
  faded: "bg-[rgba(153,156,140,0.12)] text-fade",
};

/**
 * Versão sólida de cada papel — usada como ponto/dot de categoria, cor de
 * barra em gráficos e base de avatar, para que chip, avatar e gráfico venham
 * sempre da mesma paleta (DB-2).
 */
export const SEMANTIC_SOLID: Record<SemanticTone, string> = {
  info: "#5b9bd5",
  success: "#5fb87a",
  waiting: "#d8cb6a",
  progress: "#8b7fd4",
  attention: "#d47fa8",
  danger: "#c4553e",
  neutral: "#83857a",
  faded: "#999c8c",
};

/** Fundos de avatar (texto branco) — tons médios que leem bem sobre o carvão. */
const AVATAR_TONES: string[] = [
  "#3a7d5c",
  "#ae9f4a",
  "#8b7fd4",
  "#3f6fb0",
  "#5b9bd5",
  "#d47fa8",
];

/** Hash estável de string (djb2-ish) — mesmo nome sempre gera a mesma cor. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Cor de avatar derivada de um nome, sempre a mesma para o mesmo nome. */
export function avatarColorFromName(name: string): string {
  return AVATAR_TONES[hashString(name) % AVATAR_TONES.length];
}

/** Iniciais de um nome: 1 palavra → 2 primeiras letras; 2+ → primeira de cada ponta. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
