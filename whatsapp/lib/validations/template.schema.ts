import { z } from "zod";

export const templateFormSchema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(60, "Máximo de 60 caracteres"),
  body: z.string().trim().min(1, "Informe o texto da mensagem"),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;
