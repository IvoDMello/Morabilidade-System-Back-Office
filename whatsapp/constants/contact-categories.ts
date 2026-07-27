import { SEMANTIC_SOLID, SEMANTIC_TONES } from "./semantic-colors";

export const CONTACT_CATEGORIES = [
  { value: "proprietario", label: "Proprietário" },
  { value: "cliente", label: "Cliente" },
  { value: "locatario", label: "Locatário" },
  { value: "lead", label: "Lead" },
  { value: "parceiro", label: "Parceiro" },
  { value: "outro", label: "Outro" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["value"];

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> =
  Object.fromEntries(
    CONTACT_CATEGORIES.map((c) => [c.value, c.label]),
  ) as Record<ContactCategory, string>;

// Cores dos badges de categoria — mapeadas para a paleta semântica única
// (ver constants/semantic-colors.ts). Uma cor por papel, sem colisões.
export const CONTACT_CATEGORY_COLORS: Record<ContactCategory, string> = {
  proprietario: SEMANTIC_TONES.progress,
  cliente: SEMANTIC_TONES.info,
  locatario: SEMANTIC_TONES.success,
  lead: SEMANTIC_TONES.waiting,
  parceiro: SEMANTIC_TONES.attention,
  outro: SEMANTIC_TONES.neutral,
};

// Versão sólida (hex) das mesmas cores — usada nas barras do dashboard (DB-2),
// para a cor da barra ser a mesma cor do badge daquela categoria.
export const CONTACT_CATEGORY_SOLID: Record<ContactCategory, string> = {
  proprietario: SEMANTIC_SOLID.progress,
  cliente: SEMANTIC_SOLID.info,
  locatario: SEMANTIC_SOLID.success,
  lead: SEMANTIC_SOLID.waiting,
  parceiro: SEMANTIC_SOLID.attention,
  outro: SEMANTIC_SOLID.neutral,
};
