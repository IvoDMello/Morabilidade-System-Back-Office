"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarDays, Check, MoreHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { EmptyState } from "@/components/shared/empty-state";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { ReminderStatusBadge } from "@/features/contacts/reminders/components/reminder-status-badge";
import { ReminderRelativeTime } from "./reminder-relative-time";
import { cn, formatDateTime } from "@/lib/utils";
import {
  cancelReminderAction,
  completeReminderAction,
  deleteReminderAction,
} from "@/app/contatos/actions";
import type { ID } from "@/types/common";
import type { ReminderWithContact } from "@/types/reminder";

type ReminderGroupVariant = "overdue" | "today" | "upcoming";

const VARIANT_CONFIG = {
  overdue: {
    icon: AlertTriangle,
    dot: "#ef7a7a",
    dotGlow: "rgba(239,122,122,0.18)",
    title: "text-ember",
    count: "bg-[#ef7a7a] text-white",
    border: "border-l-[3px] border-l-[#ef7a7a] hover:border-[rgba(239,122,122,0.4)] hover:border-l-[#ef7a7a]",
  },
  today: {
    icon: CalendarClock,
    dot: "var(--primary)",
    dotGlow: "color-mix(in srgb, var(--primary) 18%, transparent)",
    title: "text-gold",
    count: "bg-[#e7dda6] text-[#1b1c16]",
    border: "border-l-[3px] border-l-[#e7dda6] hover:border-[rgba(231,221,166,0.4)] hover:border-l-[#e7dda6]",
  },
  upcoming: {
    icon: CalendarDays,
    dot: "#5aa2f7",
    dotGlow: "rgba(90,162,247,0.18)",
    title: "text-sky",
    count: "bg-[#5aa2f7] text-white",
    border: "border-l-[3px] border-l-[#5aa2f7] hover:border-[rgba(90,162,247,0.4)] hover:border-l-[#5aa2f7]",
  },
};

interface RemindersGroupProps {
  title: string;
  variant: ReminderGroupVariant;
  reminders: ReminderWithContact[];
  emptyLabel: string;
}

export function RemindersGroup({ title, variant, reminders, emptyLabel }: RemindersGroupProps) {
  const { icon: Icon, dot, dotGlow, title: titleClass, count: countClass, border: borderClass } = VARIANT_CONFIG[variant];
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<ID | null>(null);
  const deleteTarget = reminders.find((r) => r.id === deleteId) ?? null;

  function handleComplete(reminder: ReminderWithContact) {
    startTransition(async () => {
      try {
        await completeReminderAction(reminder.contactId, reminder.id);
        toast.success("Lembrete concluído.");
      } catch {
        toast.error("Não foi possível concluir o lembrete.");
      }
    });
  }

  function handleCancel(reminder: ReminderWithContact) {
    startTransition(async () => {
      try {
        await cancelReminderAction(reminder.contactId, reminder.id);
        toast.success("Lembrete cancelado.");
      } catch {
        toast.error("Não foi possível cancelar o lembrete.");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteReminderAction(deleteTarget.contactId, deleteTarget.id);
        toast.success("Lembrete excluído.");
      } catch {
        toast.error("Não foi possível excluir o lembrete.");
      } finally {
        setDeleteId(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ backgroundColor: dot, boxShadow: `0 0 0 3px ${dotGlow}` }}
          />
          <span className={cn("text-[13.5px] font-semibold", titleClass)}>{title}</span>
          <span className={cn("rounded-full px-2 py-px text-xs font-semibold", countClass)}>
            {reminders.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <EmptyState icon={Icon} title={emptyLabel} />
        ) : (
          <ul className="flex flex-col gap-3">
            {reminders.map((reminder) => {
              const isOverdue = reminder.status === "pendente" && variant === "overdue";
              return (
                <li
                  key={reminder.id}
                  className={cn(
                    "rounded-xl border border-veil/7 bg-raised p-3 transition-colors hover:border-veil/14",
                    borderClass,
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{reminder.title}</p>
                      <Link
                        href={`/contatos/${reminder.contactId}`}
                        className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
                      >
                        <AvatarInitials name={reminder.contactName} size="sm" />
                        <span className="truncate">{reminder.contactName}</span>
                      </Link>
                      <div className="mt-1">
                        {reminder.status === "pendente" ? (
                          <ReminderRelativeTime date={reminder.reminderAt} isOverdue={isOverdue} />
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(reminder.reminderAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <ReminderStatusBadge status={reminder.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-1.5">
                    {reminder.status === "pendente" ? (
                      <Button
                        size="sm"
                        loading={isPending}
                        onClick={() => handleComplete(reminder)}
                        className="shadow-none bg-[rgba(126,196,145,0.14)] bg-none text-jade-soft hover:bg-[rgba(126,196,145,0.24)] hover:brightness-100"
                      >
                        {!isPending && <Check className="h-3.5 w-3.5" />}
                        Concluir
                      </Button>
                    ) : (
                      <span />
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label="Mais ações" />}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {reminder.status === "pendente" && (
                          <DropdownMenuItem onClick={() => handleCancel(reminder)}>
                            <X className="h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(reminder.id)}>
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lembrete</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lembrete &quot;{deleteTarget?.title}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction loading={isPending} onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
