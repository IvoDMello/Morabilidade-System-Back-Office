import type { Captacao } from "@/types";

/**
 * Lógica pura do cadastro de imóvel a partir de uma captação.
 * Separada do componente para ser testável (o ambiente de teste é node).
 *
 * Nota: o `anuncio_url` da captação é referência interna (anúncio de outras
 * imobiliárias) e NÃO é enviado ao imóvel. As fotos também não vão, elas são
 * do cliente e ficam só na captação. O cadastro envia apenas os campos abaixo.
 */

export type CadastroForm = {
  tipo_negocio: string;
  tipo_imovel: string;
  condicao: string;
  cidade: string;
  bairro: string;
  logradouro: string;
  numero: string;
  complemento: string;
  andar: string;
  dormitorios: string;
  suites: string;
  banheiros: string;
  vagas_garagem: string;
  area_util: string;
  valor_venda: string;
  valor_locacao: string;
  condominio_mensal: string;
  iptu_mensal: string;
  observacoes_internas: string;
  prop_nome: string;
  prop_whatsapp: string;
};

export const numToStr = (n: number | null | undefined): string =>
  n == null ? "" : String(n);

export const strToNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Tipo de negócio inferido dos valores informados na captação. */
export function tipoNegocioInicial(c: Captacao): string {
  if (c.valor_aluguel != null && c.valor_venda != null) return "ambos";
  if (c.valor_aluguel != null) return "locacao";
  return "venda";
}

/** Estado inicial do formulário a partir da captação (defaults seguros, editáveis). */
export function formInicial(c: Captacao): CadastroForm {
  return {
    tipo_negocio: tipoNegocioInicial(c),
    tipo_imovel: "",
    condicao: "usado",
    cidade: "Rio de Janeiro",
    bairro: c.bairro ?? "",
    logradouro: c.endereco ?? "",
    numero: "",
    complemento: c.unidade ? `Apto ${c.unidade}` : "",
    andar: numToStr(c.andar),
    dormitorios: numToStr(c.quartos),
    suites: numToStr(c.suites),
    banheiros: numToStr(c.banheiros),
    vagas_garagem: numToStr(c.vagas),
    area_util: numToStr(c.metragem),
    valor_venda: numToStr(c.valor_venda),
    valor_locacao: numToStr(c.valor_aluguel),
    condominio_mensal: numToStr(c.valor_condominio),
    iptu_mensal: numToStr(c.valor_iptu),
    observacoes_internas: c.tipo_portaria ? `Portaria: ${c.tipo_portaria}` : "",
    prop_nome: c.proprietario_nome ?? "",
    prop_whatsapp: c.whatsapp ?? "",
  };
}

/** Campos obrigatórios para o cadastro (label exibido ao usuário). */
export const CAMPOS_OBRIGATORIOS: [keyof CadastroForm, string][] = [
  ["tipo_negocio", "Tipo de negócio"],
  ["tipo_imovel", "Tipo de imóvel"],
  ["condicao", "Condição"],
  ["cidade", "Cidade"],
  ["bairro", "Bairro"],
  ["logradouro", "Logradouro"],
  ["prop_nome", "Nome do proprietário"],
];

/** Lista de labels dos obrigatórios ainda vazios. */
export function camposFaltando(form: CadastroForm): string[] {
  return CAMPOS_OBRIGATORIOS.filter(([k]) => !form[k].trim()).map(([, label]) => label);
}

/** Monta o corpo enviado ao route handler (proprietário + imóvel). */
export function montarRequest(form: CadastroForm) {
  return {
    proprietario: {
      nome_completo: form.prop_nome.trim(),
      telefone: form.prop_whatsapp.trim(),
    },
    imovel: {
      tipo_negocio: form.tipo_negocio,
      tipo_imovel: form.tipo_imovel,
      condicao: form.condicao,
      // Imóvel vindo de captação entra como "reservado" (ainda não publicável).
      disponibilidade: "reservado",
      cidade: form.cidade.trim(),
      bairro: form.bairro.trim(),
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      andar: strToNum(form.andar),
      dormitorios: strToNum(form.dormitorios),
      suites: strToNum(form.suites),
      banheiros: strToNum(form.banheiros),
      vagas_garagem: strToNum(form.vagas_garagem),
      area_util: strToNum(form.area_util),
      valor_venda: strToNum(form.valor_venda),
      valor_locacao: strToNum(form.valor_locacao),
      condominio_mensal: strToNum(form.condominio_mensal),
      iptu_mensal: strToNum(form.iptu_mensal),
      observacoes_internas: form.observacoes_internas.trim() || null,
    },
  };
}
