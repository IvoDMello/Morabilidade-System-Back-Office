import { CONTACT_STATUS_COLORS, CONTACT_STATUS_LABELS } from "@/constants/contact-status";
import type { ContactStatus } from "@/constants/contact-status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[7px] px-2.5 py-[3px] text-[11.5px] font-medium",
        CONTACT_STATUS_COLORS[status],
      )}
    >
      {CONTACT_STATUS_LABELS[status]}
    </span>
  );
}
