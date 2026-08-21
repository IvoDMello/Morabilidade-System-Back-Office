/**
 * Vocabulário do catálogo de imóveis do sistema principal, espelhado aqui.
 *
 * O CRM lê `public.imoveis` e `public.cliente_preferencias` direto (mesmo
 * Supabase, ver lib/supabase/server.ts), então precisa conhecer os mesmos
 * valores que os CHECK constraints da API aceitam — migration 043 do
 * back-office ("lista oficial", decisão de 2026-06-26).
 *
 * Se a lista mudar lá, muda aqui: um valor a mais no formulário vira erro de
 * constraint no INSERT, e um a menos some silenciosamente da tela.
 */

/** Os cinco tipos que um imóvel pode ter no catálogo. */
export const TIPOS_IMOVEL = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "casa_vila", label: "Casa de vila" },
  { value: "casa_condominio", label: "Casa de condomínio" },
  { value: "cobertura", label: "Cobertura" },
] as const;

export type TipoImovel = (typeof TIPOS_IMOVEL)[number]["value"];

/**
 * O que a PREFERÊNCIA aceita: os cinco tipos mais "apartamento térreo", que
 * não é um tipo armazenável de imóvel — é uma busca (apartamento + andar 1),
 * herdada do filtro do site público.
 */
export const TIPOS_IMOVEL_PREFERENCIA = [
  ...TIPOS_IMOVEL,
  { value: "apartamento_terreo", label: "Apartamento térreo" },
] as const;

export type TipoImovelPreferencia = (typeof TIPOS_IMOVEL_PREFERENCIA)[number]["value"];

export const TIPO_IMOVEL_LABELS: Record<string, string> = Object.fromEntries(
  TIPOS_IMOVEL_PREFERENCIA.map((t) => [t.value, t.label]),
);

export const TIPOS_NEGOCIO = [
  { value: "venda", label: "Venda" },
  { value: "locacao", label: "Locação" },
  { value: "ambos", label: "Venda ou locação" },
] as const;

export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number]["value"];

export const TIPO_NEGOCIO_LABELS: Record<string, string> = Object.fromEntries(
  TIPOS_NEGOCIO.map((t) => [t.value, t.label]),
);

/**
 * Imóveis de venda abaixo deste valor não entram como oportunidade.
 *
 * Regra de negócio do sistema principal (VALOR_MINIMO_OPORTUNIDADE em
 * api/app/routers/oportunidades.py): abaixo disso a demanda orgânica já dá
 * conta e a lista viraria ruído. Repetida aqui de propósito, para o CRM
 * mostrar exatamente o mesmo recorte que o painel — duas telas que discordam
 * sobre o que é oportunidade são piores que uma só.
 */
export const VALOR_MINIMO_OPORTUNIDADE = 2_000_000;
