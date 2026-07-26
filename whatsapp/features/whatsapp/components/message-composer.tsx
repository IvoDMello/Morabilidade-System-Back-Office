"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, X, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { messageFormSchema, type MessageFormValues } from "@/lib/validations/message.schema";
import { sendMessageAction } from "@/app/conversas/actions";
import { useReply } from "@/features/whatsapp/reply-context";
import { MessageTemplatesPopover } from "./message-templates-popover";
import type { ID } from "@/types/common";
import type { MessageTemplate } from "@/types/template";

const MAX_QUICK_REPLIES = 6;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function MessageComposer({
  contactId,
  contactName = "Contato",
  templates,
}: {
  contactId: ID;
  contactName?: string;
  templates: MessageTemplate[];
}) {
  const [isPending, startTransition] = useTransition();
  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const { replyingTo, clearReply } = useReply();
  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { body: "" },
  });

  const body = form.watch("body");

  // Gatilho de resposta rápida: "/" no início do campo abre a lista de
  // templates (padrão WhatsApp Business). O texto após a "/" filtra por título.
  const isQuickTrigger = body.startsWith("/");
  const quickQuery = isQuickTrigger ? body.slice(1) : "";
  const quickMatches = useMemo(() => {
    if (!isQuickTrigger) return [];
    const q = normalize(quickQuery.trim());
    const list = q
      ? templates.filter((t) => normalize(t.title).includes(q) || normalize(t.body).includes(q))
      : templates;
    return list.slice(0, MAX_QUICK_REPLIES);
  }, [isQuickTrigger, quickQuery, templates]);

  const quickOpen = isQuickTrigger && !dismissed && quickMatches.length > 0;

  // Some ao deixar de ser gatilho, e reancora o realce quando a lista muda.
  useEffect(() => {
    if (!isQuickTrigger && dismissed) setDismissed(false);
  }, [isQuickTrigger, dismissed]);
  useEffect(() => {
    setHighlighted(0);
  }, [quickQuery]);

  function aplicarTemplate(template: MessageTemplate) {
    form.setValue("body", template.body, { shouldDirty: true });
    setDismissed(true);
    form.setFocus("body");
  }

  function handleSubmit(values: MessageFormValues) {
    const reply = replyingTo;
    startTransition(async () => {
      try {
        await sendMessageAction(contactId, values, reply);
        form.reset();
        setDismissed(false);
        clearReply();
      } catch {
        toast.error("Não foi possível enviar a mensagem.");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (quickOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % quickMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + quickMatches.length) % quickMatches.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // Enter escolhe a resposta rápida em vez de enviar.
        e.preventDefault();
        const escolhido = quickMatches[highlighted] ?? quickMatches[0];
        if (escolhido) aplicarTemplate(escolhido);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.handleSubmit(handleSubmit)();
    }
  }

  return (
    <div className="mt-3">
      {replyingTo && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-jade bg-veil/5 py-1.5 pl-2 pr-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-jade">
              {replyingTo.direction === "outbound" ? "Você" : contactName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{replyingTo.body}</p>
          </div>
          <button
            type="button"
            onClick={clearReply}
            aria-label="Cancelar resposta"
            className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <form onSubmit={form.handleSubmit(handleSubmit)} className="relative flex items-end gap-2">
      {quickOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-lg border bg-popover shadow-md">
          <p className="flex items-center gap-1.5 border-b px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            Respostas rápidas
          </p>
          <ul className="max-h-56 overflow-y-auto py-1">
            {quickMatches.map((template, idx) => (
              <li key={template.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => aplicarTemplate(template)}
                  className={
                    "flex w-full flex-col gap-0.5 px-3 py-1.5 text-left " +
                    (idx === highlighted ? "bg-muted" : "")
                  }
                >
                  <span className="truncate text-sm font-medium">{template.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{template.body}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        placeholder="Escreva uma mensagem…  (digite / para respostas rápidas)"
        className="font-chat max-h-32 min-h-9 resize-none py-2"
        {...form.register("body")}
        onKeyDown={handleKeyDown}
      />
      <Button type="submit" size="icon" disabled={isPending} aria-label="Enviar mensagem">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
      </form>
    </div>
  );
}
