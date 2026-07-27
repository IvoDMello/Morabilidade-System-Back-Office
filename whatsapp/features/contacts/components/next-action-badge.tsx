import { NEXT_ACTION_COLORS, NEXT_ACTION_LABELS } from "@/constants/next-actions";
import type { NextAction } from "@/constants/next-actions";
import { cn } from "@/lib/utils";

export function NextActionBadge({ nextAction }: { nextAction: NextAction }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-medium",
        NEXT_ACTION_COLORS[nextAction],
      )}
    >
      {NEXT_ACTION_LABELS[nextAction]}
    </span>
  );
}
