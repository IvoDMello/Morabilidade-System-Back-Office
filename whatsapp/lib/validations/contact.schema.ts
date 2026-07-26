import { z } from "zod";
import { CONTACT_CATEGORIES, type ContactCategory } from "@/constants/contact-categories";
import { CONTACT_STATUSES, type ContactStatus } from "@/constants/contact-status";
import { NEXT_ACTIONS, type NextAction } from "@/constants/next-actions";
import { LOSS_REASONS, type LossReason } from "@/constants/loss-reasons";

const categoryValues = CONTACT_CATEGORIES.map((c) => c.value) as [
  ContactCategory,
  ...ContactCategory[],
];
const statusValues = CONTACT_STATUSES.map((s) => s.value) as [ContactStatus, ...ContactStatus[]];
const nextActionValues = NEXT_ACTIONS.map((a) => a.value) as [NextAction, ...NextAction[]];
const lossReasonValues = LOSS_REASONS.map((r) => r.value) as [LossReason, ...LossReason[]];

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome completo"),
  phone: z
    .string()
    .trim()
    .min(10, "Informe um telefone válido")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe um telefone válido"),
  email: z
    .union([z.literal(""), z.string().trim().email("E-mail inválido")])
    .optional(),
  category: z.enum(categoryValues),
  status: z.enum(statusValues),
  nextAction: z.enum(nextActionValues),
  // Preenchidos pelo diálogo obrigatório de "Motivo da perda" quando o status
  // muda para "perdido" — ver LossReasonDialog em contact-form.tsx.
  lossReason: z.enum(lossReasonValues).nullable().optional(),
  lossReasonNote: z.string().trim().nullable().optional(),
  generalNotes: z.string().trim().optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
