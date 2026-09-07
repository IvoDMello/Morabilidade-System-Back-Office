import type { Captacao } from "@/types";
import { foiGravada } from "./etapa";

/**
 * Contabilidade de gravações: quantas foram feitas no período, quando, e o
 * código do imóvel no sistema. Lê o que já existe no banco — gravacao_data,
 * gravacao_em, imovel_codigo, publicada_em — sem coletar nada novo.
 */

/** Dia da gravação ("YYYY-MM-DD"), preferindo a data com hora quando existe. */
export function diaDaGravacao(c: Captacao): string | null {
  if (c.gravacao_em) return c.gravacao_em.slice(0, 10);
  return c.gravacao_data;
}

export interface Periodo {
  /** "YYYY-MM-DD", inclusivo nas duas pontas. */
  de: string;
  ate: string;
}

/** Primeiro e último dia de um mês, no formato do período. */
export function mesDe(iso: string): Periodo {
  const de = `${iso.slice(0, 7)}-01`;
  const d = new Date(`${de}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { de, ate: d.toISOString().slice(0, 10) };
}

/** O mês anterior ao do período dado — a base da comparação do cabeçalho. */
export function mesAnterior(p: Periodo): Periodo {
  const d = new Date(`${p.de}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return mesDe(d.toISOString().slice(0, 10));
}

/** Gravações do período, da mais recente para a mais antiga. */
export function gravacoesNoPeriodo(cards: Captacao[], p: Periodo): Captacao[] {
  return cards
    .filter((c) => {
      if (!foiGravada(c)) return false;
      const dia = diaDaGravacao(c);
      return dia != null && dia >= p.de && dia <= p.ate;
    })
    .sort((a, b) => {
      const ka = diaDaGravacao(a) ?? "";
      const kb = diaDaGravacao(b) ?? "";
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
}

export interface ResumoGravacoes {
  total: number;
  /** Já viraram imóvel no back-office. */
  noSistema: number;
  /** Gravadas mas ainda sem código — a ausência é, ela própria, uma pendência. */
  semCadastro: number;
  publicadas: number;
  bairros: number;
}

export function resumoGravacoes(gravadas: Captacao[]): ResumoGravacoes {
  const bairros = new Set<string>();
  let noSistema = 0;
  let publicadas = 0;
  for (const c of gravadas) {
    if (c.bairro) bairros.add(c.bairro);
    if (c.imovel_codigo) noSistema++;
    if (c.publicada_em) publicadas++;
  }
  return {
    total: gravadas.length,
    noSistema,
    semCadastro: gravadas.length - noSistema,
    publicadas,
    bairros: bairros.size,
  };
}

export interface GrupoMes {
  /** "YYYY-MM" */
  mes: string;
  itens: Captacao[];
}

/** Agrupa a listagem por mês, preservando a ordem (mais recente primeiro). */
export function agruparPorMes(gravadas: Captacao[]): GrupoMes[] {
  const out: GrupoMes[] = [];
  for (const c of gravadas) {
    const dia = diaDaGravacao(c);
    if (!dia) continue;
    const mes = dia.slice(0, 7);
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.itens.push(c);
    else out.push({ mes, itens: [c] });
  }
  return out;
}
