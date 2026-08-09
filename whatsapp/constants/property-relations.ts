import { SEMANTIC_TONES } from "./semantic-colors";

/**
 * Papel do contato em relação ao imóvel (ORTOGONAL ao funil de interesse em
 * property-stages). Um papel por vínculo contato-imóvel. O `stage` só faz
 * sentido quando a relação é `interesse`.
 */
export const PROPERTY_RELATIONS = [
  { value: "proprietario", label: "Proprietário" },
  { value: "interesse", label: "Interesse" },
  { value: "visitado", label: "Visitado" },
] as const;

export type PropertyRelation = (typeof PROPERTY_RELATIONS)[number]["value"];

export const PROPERTY_RELATION_LABELS: Record<PropertyRelation, string> = Object.fromEntries(
  PROPERTY_RELATIONS.map((r) => [r.value, r.label]),
) as Record<PropertyRelation, string>;

export const PROPERTY_RELATION_COLORS: Record<PropertyRelation, string> = {
  proprietario: SEMANTIC_TONES.success,
  interesse: SEMANTIC_TONES.neutral,
  visitado: SEMANTIC_TONES.info,
};
