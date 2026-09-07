import type { Captacao } from "@/types";

export type TipoCompromisso = "visita" | "gravacao";

export const COMPROMISSO_LABEL: Record<TipoCompromisso, string> = {
  visita: "Visita",
  gravacao: "Gravação",
};

export interface Compromisso {
  captacao: Captacao;
  tipo: TipoCompromisso;
  /** ISO do início. Quando só existe data (agendamento anterior à v2), é o dia às 00:00. */
  quando: string;
  /** false quando o agendamento é antigo e só tem data — a interface esconde o horário. */
  temHora: boolean;
  duracaoMin: number;
}

/**
 * Quando um compromisso acontece. `*_em` (com hora) é a fonte da v2; `*_data`
 * (só o dia) é o que existe nos agendamentos feitos antes dela e continua
 * valendo — a migration 0023 não inventou horário para eles.
 */
export function quandoDoCompromisso(
  c: Captacao,
  tipo: TipoCompromisso
): { quando: string; temHora: boolean } | null {
  const em = tipo === "visita" ? c.visita_em : c.gravacao_em;
  if (em) return { quando: em, temHora: true };
  const data = tipo === "visita" ? c.visita_data : c.gravacao_data;
  if (data) return { quando: `${data}T00:00:00`, temHora: false };
  return null;
}

/** Todos os compromissos marcados, em ordem cronológica. */
export function compromissos(cards: Captacao[]): Compromisso[] {
  const out: Compromisso[] = [];
  for (const c of cards) {
    for (const tipo of ["visita", "gravacao"] as TipoCompromisso[]) {
      const q = quandoDoCompromisso(c, tipo);
      if (!q) continue;
      out.push({
        captacao: c,
        tipo,
        quando: q.quando,
        temHora: q.temHora,
        duracaoMin: tipo === "visita" ? c.visita_duracao_min : c.gravacao_duracao_min,
      });
    }
  }
  return out.sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));
}

/** Só o que ainda vai acontecer, a partir do começo do dia de `hoje`. */
export function proximosCompromissos(cards: Captacao[], hoje: string): Compromisso[] {
  return compromissos(cards).filter((k) => k.quando >= `${hoje}T00:00:00`);
}

export interface DiaDaAgenda {
  /** "YYYY-MM-DD" */
  dia: string;
  itens: Compromisso[];
}

/** Agrupa em dias, preservando a ordem cronológica. */
export function agruparPorDia(itens: Compromisso[]): DiaDaAgenda[] {
  const out: DiaDaAgenda[] = [];
  for (const item of itens) {
    const dia = item.quando.slice(0, 10);
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(item);
    else out.push({ dia, itens: [item] });
  }
  return out;
}

/** "Hoje" / "Amanhã" / a data por extenso — cabeçalho de cada dia da agenda. */
export function rotuloDoDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  const amanha = new Date(`${hoje}T12:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  if (dia === amanha.toISOString().slice(0, 10)) return "Amanhã";
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Fim do compromisso, para o evento no Google Agenda. Sem hora não há evento:
 * quem tem só a data precisa reagendar para virar compromisso de verdade.
 */
export function fimDoCompromisso(inicioIso: string, duracaoMin: number): string {
  return new Date(new Date(inicioIso).getTime() + duracaoMin * 60_000).toISOString();
}
