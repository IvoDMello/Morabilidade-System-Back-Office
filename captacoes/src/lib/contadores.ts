import type { Captacao } from "@/types";
import { etapaDaCaptacao, pendenciaDaCaptacao } from "./etapa";
import { contarAtrasados, retornosPendentes } from "./retorno";

/** Números da barra de abas. */
export interface Contadores {
  decidir: number;
  aprovadas: number;
  /** Pendências de agendamento — o que a aba Agenda cobra. */
  agenda: number;
  /** Retornos pendentes do usuário logado (o "Suas" da aba Negativadas). */
  negativadas: number;
  /** Quantos desses já venceram: é o que acende o contador em vermelho. */
  atrasados: number;
}

export function contadores(cards: Captacao[], hoje: string, userId: string): Contadores {
  let decidir = 0;
  let aprovadas = 0;
  let agenda = 0;

  for (const c of cards) {
    const etapa = etapaDaCaptacao(c);
    if (etapa === "decidir") decidir++;
    else if (etapa === "aprovada") {
      aprovadas++;
      if (pendenciaDaCaptacao(c)) agenda++;
    }
  }

  return {
    decidir,
    aprovadas,
    agenda,
    negativadas: retornosPendentes(cards, hoje, userId).length,
    atrasados: contarAtrasados(cards, hoje, userId),
  };
}

/** "YYYY-MM-DD" de hoje no fuso do navegador (o dia que a pessoa está vivendo). */
export function hojeLocal(agora: Date = new Date()): string {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
