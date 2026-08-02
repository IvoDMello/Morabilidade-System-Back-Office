import type { AgentProposalStatus, AgentToolScore } from "@/types/agent-proposal";
import type { ToolName } from "@/services/assistant/tools";

/**
 * Cálculo do placar de graduação — módulo puro, compartilhado pelas duas fontes
 * de dados (mock e Supabase) e testável sem banco.
 *
 * A régua de autonomia é a **taxa de edição**: quanto o humano ainda precisa
 * reescrever o que o agente propôs. Uma aprovação sem tocar no texto é o único
 * sinal de que o agente já escreve como a casa escreve.
 *
 * `sequenciaLimpa` existe porque a média esconde regressão: um agente com 200
 * aprovações antigas e 5 edições seguidas agora tem taxa ótima e comportamento
 * ruim. A sequência atual mostra isso na hora.
 */

/** Uma decisão já tomada, do mais recente para o mais antigo. */
export interface DecisaoRegistrada {
  tool: ToolName;
  status: AgentProposalStatus;
  decididoEm: string | null;
}

const TOOLS: ToolName[] = ["agendar_visita", "criar_captacao", "sugerir_resposta"];

/** Decisões que contam para o placar — pendente e superada não são veredito humano. */
function contaNoPlacar(status: AgentProposalStatus): boolean {
  return status === "aprovada" || status === "editada" || status === "descartada";
}

/**
 * Monta o placar por ferramenta. `decisoes` pode vir em qualquer ordem: a
 * função ordena por `decididoEm` decrescente antes de contar a sequência.
 */
export function calcularPlacar(decisoes: DecisaoRegistrada[]): AgentToolScore[] {
  const validas = decisoes.filter((d) => contaNoPlacar(d.status));

  // Mais recente primeiro — a sequência limpa é contada a partir da última decisão.
  const ordenadas = [...validas].sort((a, b) => {
    const aTime = a.decididoEm ? new Date(a.decididoEm).getTime() : 0;
    const bTime = b.decididoEm ? new Date(b.decididoEm).getTime() : 0;
    return bTime - aTime;
  });

  return TOOLS.map((tool) => {
    const daFerramenta = ordenadas.filter((d) => d.tool === tool);

    const aprovadas = daFerramenta.filter((d) => d.status === "aprovada").length;
    const editadas = daFerramenta.filter((d) => d.status === "editada").length;
    const descartadas = daFerramenta.filter((d) => d.status === "descartada").length;
    const decididas = daFerramenta.length;

    let sequenciaLimpa = 0;
    for (const d of daFerramenta) {
      if (d.status !== "aprovada") break;
      sequenciaLimpa++;
    }

    return {
      tool,
      decididas,
      aprovadas,
      editadas,
      descartadas,
      taxaEdicao: decididas === 0 ? null : editadas / decididas,
      sequenciaLimpa,
    };
  });
}

/** Critério de graduação sugerido: sequência limpa mínima e teto de edição. */
export const META_GRADUACAO = {
  sequenciaLimpaMinima: 20,
  taxaEdicaoMaxima: 0.15,
};

/**
 * Se esta ferramenta já poderia rodar com mais autonomia. É um **indicador**,
 * não um gatilho: quem promove é gente, olhando o número. Nada no código muda
 * de comportamento por causa deste retorno.
 */
export function atingiuMeta(score: AgentToolScore): boolean {
  if (score.taxaEdicao === null) return false;
  return (
    score.sequenciaLimpa >= META_GRADUACAO.sequenciaLimpaMinima &&
    score.taxaEdicao <= META_GRADUACAO.taxaEdicaoMaxima
  );
}
