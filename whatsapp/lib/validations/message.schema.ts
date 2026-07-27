import { z } from "zod";

export const messageFormSchema = z.object({
  body: z.string().trim().min(1, "Escreva uma mensagem"),
});

export type MessageFormValues = z.infer<typeof messageFormSchema>;
