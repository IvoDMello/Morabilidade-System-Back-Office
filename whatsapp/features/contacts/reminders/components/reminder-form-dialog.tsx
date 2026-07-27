"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReminderForm } from "./reminder-form";
import type { ReminderFormValues } from "@/lib/validations/reminder.schema";
import type { ContactReminder } from "@/types/reminder";

interface ReminderFormDialogProps {
  trigger: React.ReactElement;
  title: string;
  reminder?: ContactReminder;
  onSubmit: (values: ReminderFormValues) => Promise<void>;
  defaultOpen?: boolean;
}

export function ReminderFormDialog({
  trigger,
  title,
  reminder,
  onSubmit,
  defaultOpen = false,
}: ReminderFormDialogProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ReminderForm reminder={reminder} onSubmit={onSubmit} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
