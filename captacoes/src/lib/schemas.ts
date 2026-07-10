import { z } from "zod";
import { STATUSES } from "@/types";
import { parseMoeda } from "@/lib/format";

export const statusEnum = z.enum(STATUSES);

// "" ou null/undefined -> null; senão Number(). Mantém numéricos opcionais.
const numeroOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().min(0).max(99).nullable()
);

// metragem: aceita decimal (ex.: 72.5); "" -> null.
const metragemOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
  z.number().min(0).max(100000).nullable()
);

// valores monetários: aceita "1.234,56"/"1234.56"; "" -> null.
const moedaOpcional = z.preprocess(
  (v) => parseMoeda(v),
  z.number().min(0).nullable()
);

// "" -> null; valida URL quando preenchido.
const urlOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().url("Link inválido (inclua https://)").nullable()
);

export const captacaoSchema = z.object({
  endereco: z.string().min(1, "Endereço é obrigatório"),
  unidade: z.string().max(60).nullable().optional(),
  bairro: z.string().max(120).nullable().optional(),
  andar: numeroOpcional,
  quartos: numeroOpcional,
  suites: numeroOpcional,
  banheiros: numeroOpcional,
  vagas: numeroOpcional,
  metragem: metragemOpcional,
  tipo_portaria: z.string().max(120).nullable().optional(),
  proprietario_nome: z.string().max(160).nullable().optional(),
  whatsapp: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "WhatsApp inválido (inclua DDD)"),
  anuncio_url: urlOpcional,
  valor_venda: moedaOpcional,
  valor_aluguel: moedaOpcional,
  valor_condominio: moedaOpcional,
  valor_iptu: moedaOpcional,
  observacoes: z.string().nullable().optional(),
  pendencias: z.string().nullable().optional(),
});
export type CaptacaoInput = z.infer<typeof captacaoSchema>;

export const moverSchema = z.object({
  para_status: statusEnum,
  ordem: z.number(),
  decisao: z.enum(["aprovada", "reprovada"]).nullable().optional(),
});
export type MoverInput = z.infer<typeof moverSchema>;

export const agendamentoSchema = z.object({
  visita_concluida: z.boolean().optional(),
  visita_data: z.string().nullable().optional(),
  gravacao_concluida: z.boolean().optional(),
  gravacao_data: z.string().nullable().optional(),
});

/** "visita e gravação no mesmo dia" — preenche ambas as datas. */
export const mesmoDiaSchema = z.object({ data: z.string() });

export const videoSchema = z.object({
  url_externa: z.string().url("URL inválida"),
});

export const signUploadSchema = z.object({
  captacao_id: z.string().uuid(),
  tipo: z.enum(["foto", "documento"]),
  ext: z.string().regex(/^[a-z0-9]+$/i),
});
