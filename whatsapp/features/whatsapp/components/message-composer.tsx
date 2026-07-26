"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageFormSchema, type MessageFormValues } from "@/lib/validations/message.schema";
import { sendMessageAction } from "@/app/conversas/actions";
import { MessageTemplatesPopover } from "./message-templates-popover";
import type { ID } from "@/types/common";
import type { MessageTemplate } from "@/types/template";

export function MessageComposer({
  contactId,
  templates,
}: {
  contactId: ID;
  templates: MessageTemplate[];
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { body: "" },
  });

  function handleSubmit(values: MessageFormValues) {
    startTransition(async () => {
      try {
        await sendMessageAction(contactId, values);
        form.reset();
      } catch {
        toast.error("Não foi possível enviar a mensagem.");
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-3 flex items-end gap-2">
      <MessageTemplatesPopover
        contactId={contactId}
        templates={templates}
        onSelect={(body) => {
          form.setValue("body", body, { shouldDirty: true });
          form.setFocus("body");
        }}
      />
      <Textarea
        rows={1}
        placeholder="Escreva uma mensagem..."
        className="font-chat max-h-32 min-h-9 resize-none py-2"
        {...form.register("body")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form.handleSubmit(handleSubmit)();
          }
        }}
      />
      <Button type="submit" size="icon" disabled={isPending} aria-label="Enviar mensagem">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}
