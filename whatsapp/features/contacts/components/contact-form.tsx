"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { unstable_rethrow } from "next/navigation";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionLabel } from "@/components/shared/form-section-label";
import { CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS } from "@/constants/contact-categories";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS, type ContactStatus } from "@/constants/contact-status";
import { NEXT_ACTIONS, NEXT_ACTION_LABELS } from "@/constants/next-actions";
import type { LossReason } from "@/constants/loss-reasons";
import { contactFormSchema, type ContactFormValues } from "@/lib/validations/contact.schema";
import { formatPhone } from "@/lib/utils";
import type { Contact } from "@/types/contact";
import { LossReasonDialog } from "./loss-reason-dialog";

interface ContactFormProps {
  contact?: Contact;
  onSubmit: (values: ContactFormValues) => Promise<void>;
}

export function ContactForm({ contact, onSubmit }: ContactFormProps) {
  const [isPending, startTransition] = useTransition();
  const [lossDialogOpen, setLossDialogOpen] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? "",
      phone: contact ? formatPhone(contact.phone) : "",
      email: contact?.email ?? "",
      category: contact?.category ?? "lead",
      status: contact?.status ?? "novo",
      nextAction: contact?.nextAction ?? "aguardar_retorno",
      lossReason: contact?.lossReason ?? null,
      lossReasonNote: contact?.lossReasonNote ?? null,
      generalNotes: contact?.generalNotes ?? "",
    },
  });

  function handleStatusChange(value: string | null) {
    if (!value) return;
    const newStatus = value as ContactStatus;
    const currentStatus = form.getValues("status");
    if (newStatus === currentStatus) return;

    if (newStatus === "perdido") {
      setLossDialogOpen(true);
      return;
    }

    if (currentStatus === "perdido") {
      form.setValue("lossReason", null);
      form.setValue("lossReasonNote", null);
    }
    form.setValue("status", newStatus, { shouldValidate: true, shouldDirty: true });
  }

  function handleLossConfirm(reason: LossReason, note: string | null) {
    form.setValue("status", "perdido", { shouldValidate: true, shouldDirty: true });
    form.setValue("lossReason", reason, { shouldDirty: true });
    form.setValue("lossReasonNote", note, { shouldDirty: true });
  }

  function handleSubmit(values: ContactFormValues) {
    startTransition(async () => {
      try {
        await onSubmit(values);
      } catch (error) {
        unstable_rethrow(error);
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o contato.");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <FormSectionLabel>Identificação</FormSectionLabel>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input placeholder="Nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 98888-7777" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <FormSectionLabel>Classificação</FormSectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          CONTACT_CATEGORY_LABELS[value as keyof typeof CONTACT_CATEGORY_LABELS]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONTACT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={handleStatusChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          CONTACT_STATUS_LABELS[value as keyof typeof CONTACT_STATUS_LABELS]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONTACT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>

          <FormField
            control={form.control}
            name="nextAction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Próxima ação *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value: string) =>
                          NEXT_ACTION_LABELS[value as keyof typeof NEXT_ACTION_LABELS]
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {NEXT_ACTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <FormSectionLabel>Notas</FormSectionLabel>
          <FormField
            control={form.control}
            name="generalNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações gerais</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Observações gerais sobre o contato" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" loading={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>

      <LossReasonDialog
        open={lossDialogOpen}
        onOpenChange={setLossDialogOpen}
        onConfirm={handleLossConfirm}
      />
    </Form>
  );
}
