import { z } from "zod";

export const simulateMessageFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe um telefone válido"),
  profileName: z.string().trim().optional(),
  body: z.string().trim().min(1, "Escreva uma mensagem"),
});

export type SimulateMessageFormValues = z.infer<typeof simulateMessageFormSchema>;
