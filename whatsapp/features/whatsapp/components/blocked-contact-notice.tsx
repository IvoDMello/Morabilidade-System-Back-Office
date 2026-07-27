"use client";

import { useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setContactBlockedAction } from "@/app/conversas/actions";
import type { ID } from "@/types/common";

/** Substitui o composer quando o contato está bloqueado — como no WhatsApp,
 * com o atalho de desbloquear na própria barra. */
export function BlockedContactNotice({ contactId }: { contactId: ID }) {
  const [isPending, startTransition] = useTransition();

  function handleUnblock() {
    startTransition(async () => {
      try {
        await setContactBlockedAction(contactId, false);
      } catch {
        toast.error("Não foi possível desbloquear o contato.");
      }
    });
  }

  return (
    <div className="flex items-center justify-center gap-2 py-1.5 text-sm text-muted-foreground">
      <Ban className="h-4 w-4 shrink-0" />
      <span>Você bloqueou este contato.</span>
      <button
        type="button"
        onClick={handleUnblock}
        disabled={isPending}
        className="inline-flex items-center gap-1 font-medium text-jade hover:underline disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Desbloquear
      </button>
    </div>
  );
}
