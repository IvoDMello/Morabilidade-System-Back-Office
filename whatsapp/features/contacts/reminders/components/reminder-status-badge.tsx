import { REMINDER_STATUS_COLORS, REMINDER_STATUS_LABELS } from "@/constants/reminder-status";
import type { ReminderStatus } from "@/constants/reminder-status";
import { cn } from "@/lib/utils";

export function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-medium",
        REMINDER_STATUS_COLORS[status],
      )}
    >
      {REMINDER_STATUS_LABELS[status]}
    </span>
  );
}
