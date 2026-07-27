"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { noteFormSchema, type NoteFormValues } from "@/lib/validations/note.schema";
import type { ID } from "@/types/common";
import { addNoteAction } from "@/app/contatos/actions";

export function NoteForm({ contactId, onSuccess }: { contactId: ID; onSuccess?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { note: "" },
  });

  function handleSubmit(values: NoteFormValues) {
    startTransition(async () => {
      try {
        await addNoteAction(contactId, values);
        form.reset();
        toast.success("Anotação adicionada.");
        onSuccess?.();
      } catch {
        toast.error("Não foi possível adicionar a anotação.");
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-2">
      <Textarea
        rows={3}
        placeholder="Escreva uma anotação sobre este contato..."
        {...form.register("note")}
      />
      {form.formState.errors.note && (
        <p className="text-sm text-destructive">{form.formState.errors.note.message}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={isPending} size="sm">
          {isPending ? "Adicionando..." : "Adicionar anotação"}
        </Button>
      </div>
    </form>
  );
}
