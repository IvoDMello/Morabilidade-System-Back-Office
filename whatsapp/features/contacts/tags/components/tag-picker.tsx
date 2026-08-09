"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TAG_COLOR_CLASSES } from "@/constants/tag-colors";
import { cn } from "@/lib/utils";
import {
  addTagToContactAction,
  createTagAction,
  removeTagFromContactAction,
} from "@/app/contatos/actions";
import type { ID } from "@/types/common";
import type { Tag } from "@/types/tag";

interface TagPickerProps {
  contactId: ID;
  contactTags: Tag[];
  allTags: Tag[];
}

export function TagPicker({ contactId, contactTags, allTags }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const contactTagIds = new Set(contactTags.map((t) => t.id));
  const availableTags = allTags.filter(
    (t) => !contactTagIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase()),
  );
  const hasExactMatch = allTags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  function handleAdd(tagId: ID) {
    startTransition(async () => {
      try {
        await addTagToContactAction(contactId, tagId);
        setSearch("");
      } catch {
        toast.error("Não foi possível adicionar a etiqueta.");
      }
    });
  }

  function handleCreate() {
    const name = search.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createTagAction(contactId, { name });
        setSearch("");
        setOpen(false);
      } catch {
        toast.error("Não foi possível criar a etiqueta.");
      }
    });
  }

  function handleRemove(tagId: ID) {
    startTransition(async () => {
      try {
        await removeTagFromContactAction(contactId, tagId);
      } catch {
        toast.error("Não foi possível remover a etiqueta.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {contactTags.map((tag) => (
        <span
          key={tag.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-medium",
            TAG_COLOR_CLASSES[tag.color],
          )}
        >
          {tag.name}
          <button
            type="button"
            aria-label={`Remover etiqueta ${tag.name}`}
            disabled={isPending}
            onClick={() => handleRemove(tag.id)}
            className="rounded-full p-0.5 hover:bg-black/10"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="h-3.5 w-3.5" />
          Etiqueta
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <Input
            aria-label="Buscar ou criar etiqueta"
            placeholder="Buscar ou criar etiqueta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                disabled={isPending}
                onClick={() => handleAdd(tag.id)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className={cn("h-2 w-2 rounded-full", TAG_COLOR_CLASSES[tag.color])} />
                {tag.name}
              </button>
            ))}
            {search.trim() && !hasExactMatch && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreate}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Criar etiqueta &quot;{search.trim()}&quot;
              </button>
            )}
            {availableTags.length === 0 && !search.trim() && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                Nenhuma etiqueta disponível.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
