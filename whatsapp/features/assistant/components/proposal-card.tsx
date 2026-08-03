"use client";

import { useState } from "react";
import { CalendarClock, Check, Home, MessageCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ToolName } from "@/services/assistant/tools";

/** Estado de UI de uma proposta. Não existe no banco: cobre "executando" e
 * "deu erro", que só acontecem enquanto a tela está aberta. */
export type PropostaStatus =
  | { kind: "pending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string }
  | { kind: "dismissed" };

/** O mínimo que as duas telas (console do /assistente e copiloto da conversa)
 * têm em comum. Cada host acrescenta o que é seu — id no banco, voz, etc. */
export interface PropostaExibivel {
  tool: ToolName;
  args: Record<string, unknown>;
  resumo: string;
}

const TOOL_ICON: Record<ToolName, typeof CalendarClock> = {
  agendar_visita: CalendarClock,
  criar_captacao: Home,
  sugerir_resposta: MessageCircle,
};

/** Campos propostos pela IA, visíveis antes do confirmar — o operador precisa
 * ver o que vai ser gravado, não só o resumo em prosa. Uma data mal
 * interpretada só aparece aqui. */
export function DetalhesArgs({ args }: { args: Record<string, unknown> }) {
  const entradas = Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entradas.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
      {entradas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
          <dd className="break-words">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface ProposalCardProps {
  proposta: PropostaExibivel;
  status: PropostaStatus;
  isExecuting: boolean;
  /** `textoFinal` só vem preenchido em `sugerir_resposta` — é o que estiver na
   * caixa no momento do clique, editado ou não. */
  onConfirm: (textoFinal: string | null) => void;
  onDismiss: () => void;
}

/**
 * Cartão de uma ação proposta pela IA, com confirmação humana obrigatória.
 *
 * Vive fora das duas telas que o usam (`/assistente` e o copiloto da conversa)
 * porque eram cópias que divergiram: só o copiloto mostrava os campos e deixava
 * editar a resposta antes de enviar. Divergência em tela de confirmação é risco
 * — o operador aprende um jeito de conferir e encontra outro no dia seguinte.
 */
export function ProposalCard({
  proposta,
  status,
  isExecuting,
  onConfirm,
  onDismiss,
}: ProposalCardProps) {
  const isResposta = proposta.tool === "sugerir_resposta";
  const [texto, setTexto] = useState(() => String(proposta.args.texto ?? ""));
  const Icon = TOOL_ICON[proposta.tool] ?? Sparkles;
  const podeAgir = status.kind === "pending" || status.kind === "error";

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm">{proposta.resumo}</p>
        {podeAgir && (
          <Button size="icon-sm" variant="ghost" onClick={onDismiss} aria-label="Dispensar">
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {status.kind !== "done" &&
        (isResposta ? (
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            className="text-sm"
            aria-label="Texto da resposta sugerida"
          />
        ) : (
          <DetalhesArgs args={proposta.args} />
        ))}

      {status.kind === "done" && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          ✓ {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-xs font-medium text-destructive">{status.message}</p>
      )}

      {podeAgir && (
        <Button size="sm" onClick={() => onConfirm(isResposta ? texto : null)} loading={isExecuting}>
          <Check className="h-3.5 w-3.5" />
          {isResposta ? "Enviar resposta" : "Confirmar"}
        </Button>
      )}
    </div>
  );
}
