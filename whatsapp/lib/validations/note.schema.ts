import { z } from "zod";

export const noteFormSchema = z.object({
  note: z.string().trim().min(1, "Escreva uma anotação"),
});

export type NoteFormValues = z.infer<typeof noteFormSchema>;
