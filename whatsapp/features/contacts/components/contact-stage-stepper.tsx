import { Check, X } from "lucide-react";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from "@/constants/contact-status";
import type { ContactStatus } from "@/constants/contact-status";
import { cn } from "@/lib/utils";

const FUNNEL_STAGES = CONTACT_STATUSES.filter((s) => s.value !== "perdido");

/**
 * Stepper do funil no topo da ficha (FC-3) — mesmos estágios/ordem do Pipeline
 * Kanban, para o registro individual mostrar onde está no funil sem precisar
 * abrir o board. "Perdido" é um estado terminal fora do funil linear, então só
 * aparece quando é o status atual (senão o stepper mostraria um beco sem saída).
 */
export function ContactStageStepper({ status }: { status: ContactStatus }) {
  if (status === "perdido") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
        <X className="h-4 w-4" />
        Perdido
      </div>
    );
  }

  const currentIndex = FUNNEL_STAGES.findIndex((s) => s.value === status);

  return (
    <div className="flex items-center">
      {FUNNEL_STAGES.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === FUNNEL_STAGES.length - 1;

        return (
          <div key={stage.value} className={cn("flex items-center", !isLast && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  isDone && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary/15 text-primary ring-2 ring-primary",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-center text-[11px] leading-tight whitespace-nowrap sm:block",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {CONTACT_STATUS_LABELS[stage.value]}
              </span>
            </div>
            {!isLast && (
              <div className={cn("mx-1.5 h-0.5 flex-1 rounded-full", isDone ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
