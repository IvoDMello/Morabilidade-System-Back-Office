"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { Star } from "lucide-react";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { NextActionBadge } from "@/features/contacts/components/next-action-badge";
import { cn, formatPhone } from "@/lib/utils";
import type { Contact } from "@/types/contact";

export function PipelineCard({ contact }: { contact: Contact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex touch-none cursor-grab flex-col gap-1.5 rounded-[11px] border border-veil/7 bg-card p-2.5 transition-colors hover:border-veil/16 active:cursor-grabbing",
        isDragging && "z-10 opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5">
        {contact.isFavorite && (
          <Star className="h-3 w-3 shrink-0 fill-gold text-gold" />
        )}
        <Link
          href={`/contatos/${contact.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {contact.name}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">{formatPhone(contact.phone)}</p>
      <div className="flex flex-wrap gap-1">
        <CategoryBadge category={contact.category} />
        <NextActionBadge nextAction={contact.nextAction} />
      </div>
    </div>
  );
}
