import { z } from "zod";
import { PROPERTY_STAGES, type PropertyStage } from "@/constants/property-stages";

const stageValues = PROPERTY_STAGES.map((s) => s.value) as [PropertyStage, ...PropertyStage[]];

export const propertyLinkFormSchema = z.object({
  code: z.string().trim().min(1, "Informe o código do imóvel"),
  stage: z.enum(stageValues),
});

export type PropertyLinkFormValues = z.infer<typeof propertyLinkFormSchema>;
