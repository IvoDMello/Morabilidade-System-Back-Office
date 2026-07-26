"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, Clock3, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { PendingRelativeTime } from "./pending-relative-time";
import { closeConversationAction, snoozeFollowUpAction } from "@/app/pendencias/actions";
import { formatPhone } from "@/lib/utils";
import type { PendingConversationItem } from "@/services/whatsapp.service";

interface PendingConversationCardProps {
  item: PendingConversationItem;
  showSnooze?: boolean;
}

export function PendingConversationCard({ item, showSnooze = false }: PendingConversationCardProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);
  const waitDate = item.lastInboundAt ?? item.lastMessageAt;

  function handleClose() {
    startTransition(async () => {
      try {
        await closeConversationAction(item.id);
        toast.success("Conversa encerrada.");
      } catch {
        toast.error("Não foi possível encerrar a conversa.");
      } finally {
        setConfirmClose(false);
      }
    });
  }

  function handleSnooze() {
    startTransition(async () => {
      try {
        await snoozeFollowUpAction(item.id);
        toast.success("Follow-up adiado por 1 dia.");
      } catch {
        toast.error("Não foi possível adiar o follow-up.");
      }
    });
  }

  return (
    <li className="rounded-xl border border-veil/7 bg-raised p-3 transition-colors hover:border-veil/14">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/?c=${item.contactId}`}
          className="flex min-w-0 items-start gap-2.5 hover:opacity-90"
        >
          <AvatarInitials name={item.contactName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.contactName}</p>
            <p className="text-xs text-muted-foreground">{formatPhone(item.contactPhone)}</p>
          </div>
        </Link>

        {waitDate && <PendingRelativeTime date={waitDate} />}
      </div>

      {item.property && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {item.property.code}
            {item.property.title ? ` · ${item.property.title}` : ""}
          </span>
        </div>
      )}

      {item.lastMessagePreview && (
        <p className="mt-2 line-clamp-2 text-sm text-ink-mid">{item.lastMessagePreview}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-1.5">
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`/?c=${item.contactId}`} />}
          className="shadow-none border border-veil/10 bg-transparent bg-none text-ink-mid hover:bg-veil/6 hover:brightness-100"
        >
          Abrir conversa
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showSnooze && (
              <DropdownMenuItem onClick={handleSnooze} disabled={isPending}>
                <Clock3 className="h-4 w-4" />
                Adiar por 1 dia
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setConfirmClose(true)}>
              <CheckCircle2 className="h-4 w-4" />
              Marcar como encerrada
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar a conversa com {item.contactName}? Ela sai da fila de
              pendências e volta automaticamente se o cliente mandar uma nova mensagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction loading={isPending} onClick={handleClose}>
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
