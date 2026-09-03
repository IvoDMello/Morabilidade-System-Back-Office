"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Clapperboard, Plus } from "lucide-react";
import { PautaCard } from "./PautaCard";
import { PautaDialog, type PautaDados } from "./PautaDialog";
import { usePauta } from "@/stores/pauta";
import { usePautaAcoes } from "@/lib/usePautaAcoes";
import { cn } from "@/lib/utils";
import { PAUTA_LABEL } from "@/types";

export const PAUTA_LANE_ID = "pauta-lane";

/**
 * Raia especial do quadro, à direita das colunas de status. Não é um status
 * de captação: é a agenda de gravação, montada com cartões de pauta que
 * carregam a sequência do que vai ser gravado.
 */
export function PautaLane() {
  const pautas = usePauta((s) => s.pautas);
  const acoes = usePautaAcoes();
  const [criando, setCriando] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: PAUTA_LANE_ID,
    data: { tipo: "pauta-lane" },
  });

  async function criar(dados: PautaDados) {
    await acoes.criar(dados);
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
      <div className="h-1 w-full bg-primary" />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Clapperboard className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{PAUTA_LABEL}</h2>
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {pautas.length}
        </span>
        <button
          type="button"
          onClick={() => setCriando(true)}
          title="Nova pauta"
          aria-label="Nova pauta"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext items={pautas.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {pautas.map((p) => (
            <PautaCard key={p.id} pauta={p} />
          ))}
        </SortableContext>

        {pautas.length === 0 && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="m-1 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted px-3 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Plus className="h-5 w-5" />
            <span className="font-medium">Criar a primeira pauta</span>
            <span>Uma lista ordenada do que vai ser gravado.</span>
          </button>
        )}
      </div>

      <PautaDialog open={criando} onSalvar={criar} onOpenChange={setCriando} />
    </div>
  );
}
