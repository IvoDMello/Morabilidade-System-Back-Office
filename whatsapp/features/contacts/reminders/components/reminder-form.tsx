"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reminderFormSchema, type ReminderFormValues } from "@/lib/validations/reminder.schema";
import type { ContactReminder } from "@/types/reminder";

interface ReminderFormProps {
  reminder?: ContactReminder;
  onSubmit: (values: ReminderFormValues) => Promise<void>;
  onSuccess?: () => void;
}

export function ReminderForm({ reminder, onSubmit, onSuccess }: ReminderFormProps) {
  const [isPending, startTransition] = useTransition();
  const reminderDate = reminder ? new Date(reminder.reminderAt) : null;

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: reminder?.title ?? "",
      description: reminder?.description ?? "",
      reminderDate: reminderDate ? format(reminderDate, "yyyy-MM-dd") : "",
      reminderTime: reminderDate ? format(reminderDate, "HH:mm") : "",
    },
  });

  function handleSubmit(values: ReminderFormValues) {
    startTransition(async () => {
      try {
        await onSubmit(values);
        toast.success(reminder ? "Lembrete atualizado." : "Lembrete criado.");
        onSuccess?.();
      } catch {
        toast.error("Não foi possível salvar o lembrete.");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título *</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Ligar para confirmar visita" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Detalhes do lembrete" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="reminderDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reminderTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora *</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" loading={isPending}>
            {isPending ? "Salvando..." : "Salvar lembrete"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
