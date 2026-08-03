"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnaliseIaResult } from "@/app/pendencias/actions";
import type { PendenciaDoDia } from "@/services/ai.service";

const URGENCIA: Record<PendenciaDoDia["urgencia"], { icon: string; label: string }> = {
  alta: { icon: "🔴", label: "Alta" },
  media: { icon: "🟡", label: "Média" },
  baixa: { icon: "⚪", label: "Baixa" },
};
const ORDEM: Record<PendenciaDoDia["urgencia"], number> = { alta: 0, media: 1, baixa: 2 };

interface AiRevisaoCardProps {
  result: AnaliseIaResult | null;
  isPending: boolean;
  onAnalisar: () => void;
}

/**
 * Cartão único de IA da tela de pendências. Uma leitura das conversas de hoje
 * devolve duas coisas: o que pode ter passado (lista aqui) e quais conversas
 * "aguardando resposta" são só encerramento (marcadas nos próprios cartões da
 * aba Aguardando). Por isso o botão é um só.
 */
export function AiRevisaoCard({ result, isPending, onAnalisar }: AiRevisaoCardProps) {
  const pendencias = result?.pendencias
    ? [...result.pendencias].sort((a, b) => ORDEM[a.urgencia] - ORDEM[b.urgencia])
    : [];
  const encerramentos = result ? Object.keys(result.encerramentos).length : 0;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <div>
            <h2 className="text-sm font-semibold">Revisar com IA</h2>
            <p className="text-xs text-muted-foreground">
              Lê as conversas de hoje, aponta o que pode ter passado e marca as que
              provavelmente já estão resolvidas.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onAnalisar}
          loading={isPending}
          className="w-full shrink-0 sm:w-auto"
        >
          {result ? "Revisar de novo" : "Revisar agora"}
        </Button>
      </div>

      {result && !isPending && (
        <div className="mt-3 border-t pt-3">
          {result.erro && (
            <p className="mb-2 text-sm text-muted-foreground">{result.erro}</p>
          )}

          {result.ok && (
            <>
              {pendencias.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tudo em dia — nada pendente por aqui. 👍
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendencias.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span aria-hidden="true">{URGENCIA[p.urgencia].icon}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{p.contato}</span>
                        <span className="text-muted-foreground"> — {p.motivo}</span>
                        <span className="sr-only"> (urgência {URGENCIA[p.urgencia].label})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {encerramentos > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {encerramentos === 1
                    ? "1 conversa aguardando parece já estar resolvida — está marcada na aba Aguardando."
                    : `${encerramentos} conversas aguardando parecem já estar resolvidas — estão marcadas na aba Aguardando.`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
