import { z } from "zod";

/** Tipos de mídia que a simulação pode enviar (espelha WhatsAppMessageType). */
export const SIMULATE_MEDIA_TYPES = ["image", "audio", "video", "document"] as const;

export const simulateMessageFormSchema = z
  .object({
    phone: z
      .string()
      .trim()
      .min(10, "Informe um telefone válido")
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe um telefone válido"),
    profileName: z.string().trim().optional(),
    // Vira legenda quando há mídia; obrigatório só quando não há.
    body: z.string().trim().optional(),
    mediaUrl: z
      .string()
      .trim()
      .url("Informe uma URL válida (http/https)")
      .optional()
      .or(z.literal("")),
    mediaType: z.enum(SIMULATE_MEDIA_TYPES).optional(),
  })
  .refine((v) => (v.body && v.body.length > 0) || (v.mediaUrl && v.mediaUrl.length > 0), {
    message: "Escreva uma mensagem ou informe a URL de uma mídia",
    path: ["body"],
  });

export type SimulateMessageFormValues = z.infer<typeof simulateMessageFormSchema>;
