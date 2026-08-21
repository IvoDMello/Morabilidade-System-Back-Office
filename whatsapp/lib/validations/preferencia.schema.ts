import { z } from "zod";
import { TIPOS_IMOVEL_PREFERENCIA, TIPOS_NEGOCIO } from "@/constants/oportunidades";

const TIPOS_IMOVEL_VALORES = TIPOS_IMOVEL_PREFERENCIA.map((t) => t.value);
const TIPOS_NEGOCIO_VALORES = TIPOS_NEGOCIO.map((t) => t.value);

/** Campo numérico opcional vindo de `<input>`: "" e lixo viram null, não NaN. */
const numeroOpcional = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((valor) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = typeof valor === "number" ? valor : Number(String(valor).replace(/\D/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

/** Campo de texto opcional: em branco vira null (a coluna aceita NULL). */
const textoOpcional = z
  .string()
  .nullish()
  .transform((valor) => {
    const t = (valor ?? "").trim();
    return t || null;
  });

/**
 * Perfil de busca do cliente — o que alimenta o cruzamento com o catálogo.
 *
 * Tudo é opcional de propósito: um perfil vale mesmo pela metade ("procura
 * apartamento em Ipanema" já filtra), e exigir campos faria o corretor
 * inventar valores só para conseguir salvar — que é pior que não ter o dado.
 * Quanto menos o cliente pediu, mais imóveis aparecem, e a tela diz isso.
 */
export const preferenciaFormSchema = z
  .object({
    tipoNegocio: z
      .string()
      .nullish()
      .transform((v) => (v && TIPOS_NEGOCIO_VALORES.includes(v as never) ? v : null)),
    tipoImovel: z
      .string()
      .nullish()
      .transform((v) => (v && TIPOS_IMOVEL_VALORES.includes(v as never) ? v : null)),
    cidade: textoOpcional,
    /** Aceita "Ipanema, Leblon" digitado num campo só. */
    bairros: z
      .union([z.string(), z.array(z.string())])
      .nullish()
      .transform((valor) => {
        const bruto = Array.isArray(valor) ? valor : String(valor ?? "").split(",");
        return bruto.map((b) => b.trim()).filter(Boolean);
      }),
    valorMin: numeroOpcional,
    valorMax: numeroOpcional,
    dormitoriosMin: numeroOpcional,
    vagasGaragemMin: numeroOpcional,
    observacoes: textoOpcional,
  })
  .refine(
    (v) => v.valorMin === null || v.valorMax === null || v.valorMin <= v.valorMax,
    { message: "O valor mínimo não pode ser maior que o máximo.", path: ["valorMax"] },
  );

export type PreferenciaFormValues = z.input<typeof preferenciaFormSchema>;
