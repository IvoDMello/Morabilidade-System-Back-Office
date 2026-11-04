// MoraMétrica: estado da busca na URL e formatação dos números.
//
// A busca e os filtros vivem nos parâmetros da URL (/morametrica?q=...), então
// todo resultado tem um link compartilhável e é montado no servidor.

import type { RadarSugestao } from "./api";

export const CAMINHO_MORAMETRICA = "/morametrica";

export const PARAMETROS_BUSCA = [
  "q",
  "cl",
  "numero",
  "unidade",
  "bairro",
  "tipologia",
  "desde",
  "ate",
  "todo_periodo",
  "ordem",
  "pagina",
] as const;

export type ParametroBusca = (typeof PARAMETROS_BUSCA)[number];
export type ParametrosBusca = Partial<Record<ParametroBusca, string>>;

/** Filtros que valem para um resultado e se perdem quando muda a busca. */
const FILTROS: ParametroBusca[] = ["tipologia", "desde", "ate", "todo_periodo", "ordem", "pagina"];

export function lerParametros(
  brutos: Record<string, string | string[] | undefined>,
): ParametrosBusca {
  const params: ParametrosBusca = {};
  for (const chave of PARAMETROS_BUSCA) {
    const valor = brutos[chave];
    const texto = (Array.isArray(valor) ? valor[0] : valor)?.trim();
    if (texto) params[chave] = texto.slice(0, 120);
  }
  return params;
}

export function temBusca(params: ParametrosBusca): boolean {
  return Boolean(params.q || params.cl || params.bairro);
}

export function urlMoraMetrica(params: ParametrosBusca): string {
  const busca = new URLSearchParams();
  for (const chave of PARAMETROS_BUSCA) {
    const valor = params[chave];
    if (valor) busca.set(chave, valor);
  }
  const qs = busca.toString();
  return qs ? `${CAMINHO_MORAMETRICA}?${qs}` : CAMINHO_MORAMETRICA;
}

/** Mesma busca com outros filtros. Mudar qualquer filtro volta para a página 1. */
export function comFiltros(params: ParametrosBusca, mudancas: ParametrosBusca): string {
  const novos: ParametrosBusca = { ...params, pagina: undefined, ...mudancas };
  return urlMoraMetrica(novos);
}

/** Nova busca: só a identidade (texto, rua, número, unidade ou bairro), sem filtros. */
export function novaBusca(
  identidade: Pick<ParametrosBusca, "q" | "cl" | "numero" | "unidade" | "bairro">,
): string {
  const params: ParametrosBusca = { ...identidade };
  for (const filtro of FILTROS) delete params[filtro];
  return urlMoraMetrica(params);
}

/** Busca direta a partir de um item do autocomplete ou do "Você quis dizer". */
export function urlSugestao(s: RadarSugestao): string {
  if (s.tipo === "bairro") return novaBusca({ bairro: s.bairro ?? undefined, q: s.consulta });
  // Número e unidade já digitados seguem junto ("Rua Bom Pastor, 521, BL 001 Apto 0801")
  return novaBusca({
    cl: String(s.cl),
    numero: s.numero ? String(s.numero) : undefined,
    unidade: s.unidade ?? undefined,
    q: s.consulta,
  });
}

// ── Formatação ───────────────────────────────────────────────────────────────

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Competência "2026-07-01" → "jul/2026". */
export function formatarMes(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/** Competência "2026-09-01" → "setembro de 2026". */
export function formatarMesExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MESES_EXTENSO[Number(mes) - 1]} de ${ano}`;
}

export function formatarValor(valor: number | null | undefined): string {
  return valor == null ? "Sem dado" : moeda.format(valor);
}

export function formatarM2(valor: number | null | undefined): string {
  return valor == null ? "Sem dado" : `${moeda.format(valor)}/m²`;
}

export function formatarArea(valor: number | null | undefined): string {
  return valor == null ? "Sem dado" : `${inteiro.format(valor)} m²`;
}

export function formatarInteiro(valor: number): string {
  return inteiro.format(valor);
}

export function plural(n: number, singular: string, pluralTexto: string): string {
  return `${formatarInteiro(n)} ${n === 1 ? singular : pluralTexto}`;
}

/** Texto do período de um resultado ("de out/2021 a set/2026", "desde 2011"). */
export function descreverPeriodo(
  periodo: { desde?: string | null; ate?: string | null },
  dadosAte?: string | null,
): string {
  const fim = periodo.ate ?? dadosAte;
  if (!periodo.desde) return fim ? `de 2011 a ${formatarMes(fim)}` : "desde 2011";
  return fim ? `de ${formatarMes(periodo.desde)} a ${formatarMes(fim)}` : `desde ${formatarMes(periodo.desde)}`;
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export function linkWhatsAppAvaliacao(numero: string): string {
  const mensagem = "Olá! Vim pela MoraMétrica e gostaria de anunciar meu imóvel com a Morabilidade.";
  return numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
    : "https://wa.link/we06jw";
}

// Bairros da Zona Sul em destaque na página inicial da MoraMétrica.
export const BAIRROS_ZONA_SUL = [
  "Ipanema", "Leblon", "Copacabana", "Botafogo", "Flamengo", "Lagoa", "Gávea",
  "Jardim Botânico", "Laranjeiras", "Humaitá", "Leme", "Urca", "São Conrado",
];

export const EXEMPLOS_BUSCA = ["Vieira Souto 510", "Leblon", "Copacabana"];
