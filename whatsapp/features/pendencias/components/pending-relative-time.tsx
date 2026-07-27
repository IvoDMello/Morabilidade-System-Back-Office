import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { urgencyToneForWait } from "@/constants/conversation-status";
import { cn, formatDateTime } from "@/lib/utils";
import { formatWaitTime, hoursSince } from "@/lib/wait-time";

/** Tempo de espera com cor por urgência (LB-1): neutro até 2h, âmbar 2h-24h,
 * vermelho acima de 24h. Tooltip mostra a data/hora exata. */
export function PendingRelativeTime({ date }: { date: string }) {
  const tone = urgencyToneForWait(hoursSince(date));

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "text-xs font-medium",
              tone === "danger" && "text-destructive",
              tone === "waiting" && "text-gold",
              tone === "neutral" && "text-muted-foreground",
            )}
          />
        }
      >
        {formatWaitTime(date)}
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(date)}</TooltipContent>
    </Tooltip>
  );
}
