"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CaptacaoCard } from "./CaptacaoCard";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE, type Captacao, type Status } from "@/types";

const TONE_BAR: Record<string, string> = {
  muted: "bg-muted-foreground/40",
  primary: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  positive: "bg-positive",
};

export function KanbanColumn({ status, cards }: { status: Status; cards: Captacao[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  const tone = STATUS_TONE[status];

  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className={cn("h-1 w-full", TONE_BAR[tone])} />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2>
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {cards.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <CaptacaoCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div
            className={cn(
              "m-1 flex flex-1 items-center justify-center rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors",
              isOver ? "border-primary/40 bg-primary/5" : "border-muted"
            )}
          >
            {isOver ? "Solte aqui" : "Vazio"}
          </div>
        )}
      </div>
    </div>
  );
}
