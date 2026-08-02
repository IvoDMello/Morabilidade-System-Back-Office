import { CheckCircle2, PencilLine } from "lucide-react";
import type { PlacarDoAgente } from "@/services/agent-proposals.service";
import type { ToolName } from "@/services/assistant/tools";

const TOOL_LABEL: Record<ToolName, string> = {
  agendar_visita: "Agendar visita",
  criar_captacao: "Criar captação",
  sugerir_resposta: "Sugerir resposta",
};

function pct(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}

/**
 * Placar de graduação do agente — a régua para decidir quando um processo pode
 * andar com mais autonomia.
 *
 * O número que importa é a **taxa de edição**: o quanto a equipe ainda precisa
 * reescrever o que o agente propôs. A sequência limpa (aprovações seguidas sem
 * tocar no texto) existe porque a média esconde regressão recente.
 *
 * Isto é um indicador, não um gatilho: nada no sistema muda de comportamento
 * sozinho ao bater a meta. Quem promove é gente, olhando estes números.
 */
export function PlacarAgente({ placar }: { placar: PlacarDoAgente }) {
  const temDados = placar.scores.some((s) => s.decididas > 0);
  if (!temDados) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Placar do copiloto</h2>
        <p className="text-xs text-muted-foreground">
          Quanto menos vocês precisam reescrever, mais perto o processo está de andar sozinho.
          Meta: {placar.meta.sequenciaLimpaMinima} aprovações seguidas sem edição e taxa de
          edição até {pct(placar.meta.taxaEdicaoMaxima)}.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {placar.scores.map((s) => (
          <div key={s.tool} className="flex flex-col gap-1.5 rounded-lg border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{TOOL_LABEL[s.tool]}</span>
              {s.atingiuMeta && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-jade">
                  <CheckCircle2 className="h-3 w-3" />
                  na meta
                </span>
              )}
            </div>

            {s.decididas === 0 ? (
              <p className="text-xs text-muted-foreground">Sem decisões ainda.</p>
            ) : (
              <>
                <p className="text-lg font-semibold tabular-nums tracking-[-0.02em]">
                  {s.taxaEdicao === null ? "—" : pct(s.taxaEdicao)}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    editadas
                  </span>
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <PencilLine className="h-3 w-3" />
                  {s.sequenciaLimpa} seguidas sem edição · {s.decididas} decisões
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
