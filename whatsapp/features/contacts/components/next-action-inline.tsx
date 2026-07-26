import { NEXT_ACTION_ICONS, NEXT_ACTION_LABELS } from "@/constants/next-actions";
import type { NextAction } from "@/constants/next-actions";

/** Próxima ação em listas (LT-1): ícone + texto simples, sem pastel — só
 * categoria e status carregam cor, para o olho não competir entre 3 badges. */
export function NextActionInline({ nextAction }: { nextAction: NextAction }) {
  const Icon = NEXT_ACTION_ICONS[nextAction];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {NEXT_ACTION_LABELS[nextAction]}
    </span>
  );
}
