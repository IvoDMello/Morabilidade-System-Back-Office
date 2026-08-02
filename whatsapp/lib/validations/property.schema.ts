import { z } from "zod";
import { PROPERTY_STAGES, type PropertyStage } from "@/constants/property-stages";
import { PROPERTY_RELATIONS, type PropertyRelation } from "@/constants/property-relations";

const stageValues = PROPERTY_STAGES.map((s) => s.value) as [PropertyStage, ...PropertyStage[]];
const relationValues = PROPERTY_RELATIONS.map((r) => r.value) as [
  PropertyRelation,
  ...PropertyRelation[],
];

export const propertyLinkFormSchema = z.object({
  code: z.string().trim().min(1, "Informe o código do imóvel"),
  relacao: z.enum(relationValues).default("interesse"),
  stage: z.enum(stageValues),
});

export type PropertyLinkFormValues = z.infer<typeof propertyLinkFormSchema>;
