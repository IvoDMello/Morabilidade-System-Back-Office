"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analisarPendenciasAction, type AnalisePendenciasResult } from "@/app/pendencias/actions";
import type { PendenciaDoDia } from "@/services/ai.service";

const URGENCIA: Record<PendenciaDoDia["urgencia"], { icon: string; label: string; className: string }> = {
  alta:  { icon: "🔴", label: "Alta",  className: "text-ember" },
  media: { icon: "🟡", label: "Média", className: "text-gold" },
  baixa: { icon: "⚪", label: "Baixa", className: "text-muted-foreground" },
};
const ORDEM: Record<PendenciaDoDia["urgencia"], number> = { alta: 0, media: 1, baixa: 2 };

/**
 * Análise de pendências do dia sob demanda (IA). Botão que lê as conversas com
 * atividade hoje e lista o que pode ter passado — promessas não cumpridas,
 * perguntas sem resposta, leads novos. Best-effort: mostra erro amigável.
 */
export function AiPendencias() {
  const [result, setResult] = useState<AnalisePendenciasResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function analisar() {
    startTransition(async () => {
      setResult(await analisarPendenciasAction());
    });
  }

  const pendencias = result?.pendencias
    ? [...result.pendencias].sort((a, b) => ORDEM[a.urgencia] - ORDEM[b.urgencia])
    : [];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          <div>
            <p className="text-sm font-semibold">Assistente — pendências do dia</p>
            <p className="text-xs text-muted-foreground">
              A IA lê as conversas de hoje e aponta o que pode ter passado.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={analisar} loading={isPending} className="shrink-0">
          {result ? "Analisar de novo" : "Analisar com IA"}
        </Button>
      </div>

      {result && !isPending && (
        <div className="mt-3 border-t pt-3">
          {result.erro ? (
            <p className="text-sm text-muted-foreground">{result.erro}</p>
          ) : pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo em dia — nada pendente por aqui. 👍</p>
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
        </div>
      )}
    </div>
  );
}
