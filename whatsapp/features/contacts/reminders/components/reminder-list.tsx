"use client";

import { useTransition } from "react";
import { BellRing, Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReminderFormDialog } from "./reminder-form-dialog";
import { ReminderStatusBadge } from "./reminder-status-badge";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  cancelReminderAction,
  completeReminderAction,
  deleteReminderAction,
  updateReminderAction,
} from "@/app/contatos/actions";
import type { ID } from "@/types/common";
import type { ContactReminder } from "@/types/reminder";

export function ReminderList({
  contactId,
  reminders,
}: {
  contactId: ID;
  reminders: ContactReminder[];
}) {
  const [isPending, startTransition] = useTransition();
  const now = Date.now();

  function handleComplete(id: ID) {
    startTransition(async () => {
      try {
        await completeReminderAction(contactId, id);
        toast.success("Lembrete concluído.");
      } catch {
        toast.error("Não foi possível concluir o lembrete.");
      }
    });
  }

  function handleCancel(id: ID) {
    startTransition(async () => {
      try {
        await cancelReminderAction(contactId, id);
        toast.success("Lembrete cancelado.");
      } catch {
        toast.error("Não foi possível cancelar o lembrete.");
      }
    });
  }

  if (reminders.length === 0) {
    return (
      <EmptyState
        icon={BellRing}
        title="Nenhum lembrete cadastrado"
        description="Crie um lembrete para não perder o próximo contato."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reminders.map((reminder) => {
        const isOverdue = reminder.status === "pendente" && new Date(reminder.reminderAt).getTime() < now;

        return (
          <li
            key={reminder.id}
            className={cn(
              "rounded-lg border bg-card p-3",
              isOverdue && "border-destructive/50 bg-destructive/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{reminder.title}</p>
                {reminder.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{reminder.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(reminder.reminderAt)}
                </p>
              </div>
              <ReminderStatusBadge status={reminder.status} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {reminder.status === "pendente" && (
                <>
                  <Button size="sm" variant="outline" loading={isPending} onClick={() => handleComplete(reminder.id)}>
                    {!isPending && <Check className="h-3.5 w-3.5" />}
                    Concluir
                  </Button>
                  <Button size="sm" variant="outline" loading={isPending} onClick={() => handleCancel(reminder.id)}>
                    {!isPending && <X className="h-3.5 w-3.5" />}
                    Cancelar
                  </Button>
                  <ReminderFormDialog
                    trigger={
                      <Button size="sm" variant="outline">
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    }
                    title="Editar lembrete"
                    reminder={reminder}
                    onSubmit={(values) => updateReminderAction(contactId, reminder.id, values)}
                  />
                </>
              )}
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    Excluir
                  </Button>
                }
                title="Excluir lembrete"
                description={`Tem certeza que deseja excluir o lembrete "${reminder.title}"?`}
                confirmLabel="Excluir"
                onConfirm={() => deleteReminderAction(contactId, reminder.id)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
