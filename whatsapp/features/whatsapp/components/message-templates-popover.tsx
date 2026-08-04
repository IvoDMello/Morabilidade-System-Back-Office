"use client";

import { useState, useTransition } from "react";
import { LayoutTemplate, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { createTemplateAction, deleteTemplateAction } from "@/app/conversas/actions";
import type { ID } from "@/types/common";
import type { MessageTemplate } from "@/types/template";

interface MessageTemplatesPopoverProps {
  contactId: ID;
  templates: MessageTemplate[];
  onSelect: (body: string) => void;
}

export function MessageTemplatesPopover({
  contactId,
  templates,
  onSelect,
}: MessageTemplatesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSelect(template: MessageTemplate) {
    onSelect(template.body);
    setOpen(false);
  }

  function handleDelete(templateId: ID) {
    startTransition(async () => {
      try {
        await deleteTemplateAction(contactId, templateId);
      } catch {
        toast.error("Não foi possível excluir o template.");
      }
    });
  }

  function handleCreate() {
    if (!title.trim() || !body.trim()) return;
    startTransition(async () => {
      try {
        await createTemplateAction(contactId, { title: title.trim(), body: body.trim() });
        setTitle("");
        setBody("");
        setCreating(false);
      } catch {
        toast.error("Não foi possível criar o template.");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Mensagens prontas"
          />
        }
      >
        <LayoutTemplate className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="flex flex-col gap-1">
          <p className="px-1 text-xs font-medium text-muted-foreground">Mensagens prontas</p>
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-1 rounded-md hover:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(template)}
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm"
                  title={template.body}
                >
                  {template.title}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={isPending}
                  onClick={() => handleDelete(template.id)}
                  aria-label={`Excluir template ${template.title}`}
                  className="mr-1"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                Nenhum template ainda.
              </p>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        {creating ? (
          <div className="flex flex-col gap-2">
            <Input
              aria-label="Título do template"
              placeholder="Título do template"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              rows={3}
              aria-label="Texto do template"
              placeholder="Texto da mensagem"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                loading={isPending}
                disabled={!title.trim() || !body.trim()}
                onClick={handleCreate}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo template
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
