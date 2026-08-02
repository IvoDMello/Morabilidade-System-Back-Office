"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, MessageCircle, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  proporAcoesAction,
  executarAcaoAction,
  type ProporResultado,
} from "@/app/assistente/actions";
import type { AcaoProposta } from "@/services/assistant";
import type { ToolName } from "@/services/assistant/tools";

type ItemStatus =
  | { kind: "pending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string }
  | { kind: "dismissed" };

interface Item extends AcaoProposta {
  status: ItemStatus;
}

const TOOL_ICON: Record<ToolName, typeof CalendarClock> = {
  agendar_visita: CalendarClock,
  criar_captacao: Sparkles,
  sugerir_resposta: MessageCircle,
};

const EXEMPLOS = [
  "Agendar visita com o Marcos amanhã às 15h no MB-00033",
  "Criar captação: Rua das Acácias 120, 3 quartos, portaria 24h",
];

export function AssistantConsole() {
  const [instrucao, setInstrucao] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [isProposing, startProposing] = useTransition();
  const [executingIdx, setExecutingIdx] = useState<number | null>(null);

  function propor() {
    setErro(null);
    startProposing(async () => {
      const res: ProporResultado = await proporAcoesAction(instrucao);
      if (!res.ok || res.propostas.length === 0) {
        setItems([]);
        setErro(res.erro ?? "Nenhuma ação identificada.");
        return;
      }
      setItems(res.propostas.map((p) => ({ ...p, status: { kind: "pending" } })));
    });
  }

  function confirmar(idx: number) {
    const item = items[idx];
    setExecutingIdx(idx);
    executarAcaoAction(item.tool, item.args).then((res) => {
      setExecutingIdx(null);
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? { ...it, status: res.ok ? { kind: "done", message: res.message } : { kind: "error", message: res.message } }
            : it,
        ),
      );
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });
  }

  function dispensar(idx: number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, status: { kind: "dismissed" } } : it)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <Textarea
          value={instrucao}
          onChange={(e) => setInstrucao(e.target.value)}
          placeholder="Descreva o que você quer fazer… (ex.: agendar visita, criar captação)"
          rows={3}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") propor();
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {EXEMPLOS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstrucao(ex)}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
          <Button onClick={propor} loading={isProposing} disabled={!instrucao.trim()}>
            <Sparkles className="h-4 w-4" />
            Analisar
          </Button>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{erro}</p>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Ações propostas — confirme para executar
          </p>
          {items.map((item, idx) => {
            if (item.status.kind === "dismissed") return null;
            const Icon = TOOL_ICON[item.tool] ?? Sparkles;
            return (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{item.resumo}</p>
                  {item.status.kind === "done" && (
                    <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ {item.status.message}
                    </p>
                  )}
                  {item.status.kind === "error" && (
                    <p className="mt-1 text-xs font-medium text-destructive">{item.status.message}</p>
                  )}
                </div>
                {(item.status.kind === "pending" || item.status.kind === "error") && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      onClick={() => confirmar(idx)}
                      loading={executingIdx === idx}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Confirmar
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => dispensar(idx)} aria-label="Dispensar">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
