import type { Captacao, Etapa, Status } from "@/types";

/**
 * Etapa (aba) de uma captação, derivada do `status` que continua no banco.
 *
 * A v2 separa dois conceitos que a v1 misturava numa coluna só: ETAPA é onde
 * a captação está no fluxo (uma só), LISTA é como a equipe organiza (várias).
 * Por isso 'gaveta' e 'selecao_especial' não têm etapa própria — viraram
 * lista, e a etapa delas vem da decisão que já está registrada no cartão.
 *
 * Sem decisão registrada, uma engavetada volta para "Decidir": ela realmente
 * não foi decidida. Para não poluir a fila do dia, a interface a mostra na
 * seção recolhida "Engavetadas — reavaliar" (ver `engavetadaSemDecisao`).
 */
export function etapaDaCaptacao(c: Pick<Captacao, "status" | "decisao">): Etapa {
  switch (c.status) {
    case "publicada":
      return "publicada";
    case "negativada":
    case "pendente_negativa":
      return "negativada";
    case "pendente_agendar_visita":
    case "pendente_agendar_gravacao":
      return "aprovada";
    case "aguardando_informacoes":
    case "novas":
    case "em_decisao":
      return "decidir";
    case "gaveta":
    case "selecao_especial":
      if (c.decisao === "aprovada") return "aprovada";
      if (c.decisao === "reprovada") return "negativada";
      return "decidir";
  }
}

/** Captação parada numa gaveta/seleção especial sem decisão: reavaliar, não decidir hoje. */
export function engavetadaSemDecisao(c: Pick<Captacao, "status" | "decisao">): boolean {
  return (c.status === "gaveta" || c.status === "selecao_especial") && c.decisao === null;
}

/** Sub-etapas da aba Decidir, na ordem em que aparecem. */
export const SUBETAPAS_DECIDIR: Status[] = ["aguardando_informacoes", "novas", "em_decisao"];

/** Próxima ação pendente de uma captação aprovada; null quando não há. */
export type Pendencia = "agendar_visita" | "agendar_gravacao";

export const PENDENCIA_LABEL: Record<Pendencia, string> = {
  agendar_visita: "Agendar visita",
  agendar_gravacao: "Agendar gravação",
};

/**
 * O que falta fazer na captação. Só a etapa 'aprovada' tem pendência de
 * agendamento — o retorno negativo é tarefa da aba Negativadas, não daqui.
 */
export function pendenciaDaCaptacao(c: Captacao): Pendencia | null {
  if (etapaDaCaptacao(c) !== "aprovada") return null;
  if (!c.visita_concluida && !c.visita_em && !c.visita_data) return "agendar_visita";
  if (!c.gravacao_concluida && !c.gravacao_em && !c.gravacao_data) return "agendar_gravacao";
  return null;
}

/** Já gravada: o que alimenta a contabilidade de gravações. */
export function foiGravada(c: Captacao): boolean {
  return c.gravacao_concluida && (c.gravacao_data !== null || c.gravacao_em !== null);
}
