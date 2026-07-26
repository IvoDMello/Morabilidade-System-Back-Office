import { SEMANTIC_TONES } from "./semantic-colors";

export const PROPERTY_STAGES = [
  { value: "interesse", label: "Interesse" },
  { value: "visita", label: "Visita agendada" },
  { value: "proposta", label: "Proposta enviada" },
] as const;

export type PropertyStage = (typeof PROPERTY_STAGES)[number]["value"];

export const PROPERTY_STAGE_LABELS: Record<PropertyStage, string> = Object.fromEntries(
  PROPERTY_STAGES.map((s) => [s.value, s.label]),
) as Record<PropertyStage, string>;

// Etapas de interesse no imóvel — paleta semântica única.
export const PROPERTY_STAGE_COLORS: Record<PropertyStage, string> = {
  interesse: SEMANTIC_TONES.neutral,
  visita: SEMANTIC_TONES.info,
  proposta: SEMANTIC_TONES.waiting,
};
