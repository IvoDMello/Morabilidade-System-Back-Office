import { Check, CheckCheck, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";

export function MessageStatusIcon({ status }: { status: WhatsAppMessageStatus }) {
  if (status === "failed") {
    return <TriangleAlert className="h-3.5 w-3.5 text-destructive" />;
  }
  if (status === "read") {
    return <CheckCheck className="h-3.5 w-3.5 text-tick" />;
  }
  if (status === "delivered") {
    return <CheckCheck className={cn("h-3.5 w-3.5 opacity-70")} />;
  }
  if (status === "sent") {
    return <Check className="h-3.5 w-3.5 opacity-70" />;
  }
  return <Clock className="h-3.5 w-3.5 opacity-70" />;
}
