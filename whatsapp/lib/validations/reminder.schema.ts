import { z } from "zod";

export const reminderFormSchema = z.object({
  title: z.string().trim().min(2, "Informe um título"),
  description: z.string().trim().optional(),
  reminderDate: z.string().min(1, "Informe a data"),
  reminderTime: z.string().min(1, "Informe a hora"),
});

export type ReminderFormValues = z.infer<typeof reminderFormSchema>;
