import { SEMANTIC_SOLID, SEMANTIC_TONES } from "./semantic-colors";

/**
 * Papel do contato no negócio — quatro, e só quatro.
 *
 * Eram seis, e três delas ("Lead", "Cliente", "Outro") não diziam nada sobre o
 * que a pessoa quer: todo contato do CRM é um lead e é um cliente em algum
 * momento, e "Outro" é o balde de quem não decidiu. O que muda o atendimento é
 * o papel — quem compra, quem aluga, quem tem imóvel conosco e quem investe.
 * Quem era "Parceiro" virou etiqueta livre (ver migration 0025).
 */
export const CONTACT_CATEGORIES = [
  { value: "comprador", label: "Comprador" },
  { value: "locatario", label: "Locatário" },
  { value: "proprietario", label: "Proprietário" },
  { value: "investidor", label: "Investidor" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["value"];

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> =
  Object.fromEntries(
    CONTACT_CATEGORIES.map((c) => [c.value, c.label]),
  ) as Record<ContactCategory, string>;

// Cores dos badges de categoria — mapeadas para a paleta semântica única
// (ver constants/semantic-colors.ts). Uma cor por papel, sem colisões.
export const CONTACT_CATEGORY_COLORS: Record<ContactCategory, string> = {
  comprador: SEMANTIC_TONES.info,
  locatario: SEMANTIC_TONES.success,
  proprietario: SEMANTIC_TONES.progress,
  investidor: SEMANTIC_TONES.attention,
};

// Versão sólida (hex) das mesmas cores — usada nas barras do dashboard (DB-2),
// para a cor da barra ser a mesma cor do badge daquela categoria.
export const CONTACT_CATEGORY_SOLID: Record<ContactCategory, string> = {
  comprador: SEMANTIC_SOLID.info,
  locatario: SEMANTIC_SOLID.success,
  proprietario: SEMANTIC_SOLID.progress,
  investidor: SEMANTIC_SOLID.attention,
};

/**
 * Categoria padrão de quem chega pelo WhatsApp sem ninguém ter classificado.
 * Antes era "lead"; com o papel obrigatório, quem manda mensagem para uma
 * imobiliária está quase sempre atrás de um imóvel para comprar — e um clique
 * corrige quando não está.
 */
export const CONTACT_CATEGORY_PADRAO: ContactCategory = "comprador";
