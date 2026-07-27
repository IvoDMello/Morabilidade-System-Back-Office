import { z } from "zod";
import { TAG_COLORS, type TagColor } from "@/constants/tag-colors";

const colorValues = TAG_COLORS.map((c) => c.value) as [TagColor, ...TagColor[]];

export const tagFormSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(30, "Máximo de 30 caracteres"),
  color: z.enum(colorValues).optional(),
});

export type TagFormValues = z.infer<typeof tagFormSchema>;
