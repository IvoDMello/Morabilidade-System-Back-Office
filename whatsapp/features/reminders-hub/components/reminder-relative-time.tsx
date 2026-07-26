import { formatDistanceToNow, isTomorrow, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Data relativa com cor de urgência (LB-1): "atrasado há 3 dias" (vermelho),
 * "em 40 min" (âmbar, vence hoje), "amanhã às 9h" / "em 5 dias" (neutro) —
 * tooltip com a data/hora exata para quem precisar do valor absoluto.
 */
export function ReminderRelativeTime({ date, isOverdue }: { date: string; isOverdue: boolean }) {
  const target = new Date(date);

  let label: string;
  let tone: "danger" | "warning" | "neutral";

  if (isOverdue) {
    tone = "danger";
    label = `Atrasado há ${formatDistanceToNow(target, { locale: ptBR })}`;
  } else if (isToday(target)) {
    tone = "warning";
    label = formatDistanceToNow(target, { addSuffix: true, locale: ptBR });
  } else if (isTomorrow(target)) {
    tone = "neutral";
    label = `Amanhã às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(target)}`;
  } else {
    tone = "neutral";
    label = formatDistanceToNow(target, { addSuffix: true, locale: ptBR });
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "text-xs font-medium",
              tone === "danger" && "text-destructive",
              tone === "warning" && "text-gold",
              tone === "neutral" && "text-muted-foreground",
            )}
          />
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(date)}</TooltipContent>
    </Tooltip>
  );
}
