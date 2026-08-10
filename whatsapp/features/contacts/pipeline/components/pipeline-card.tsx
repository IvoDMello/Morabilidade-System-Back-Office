"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { Star } from "lucide-react";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn, formatPhone } from "@/lib/utils";
import type { Contact } from "@/types/contact";

export function PipelineCard({ contact }: { contact: Contact }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  });
  const isTouch = useMediaQuery("(pointer: coarse)");

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      // O arrasto por toque começa segurando o cartão, e segurar é também o
      // gesto que abre o menu de contexto do navegador (e a seleção de texto
      // do iOS) — no meio do arrasto. No mouse o menu continua: lá o arrasto
      // é por distância, não por tempo, e o botão direito não atrapalha.
      onContextMenu={isTouch ? (e) => e.preventDefault() : undefined}
      className={cn(
        // `touch-manipulation` (não `touch-none`) deixa o dedo rolar o board
        // por cima dos cartões; quem segura o dedo cai no TouchSensor, que a
        // partir dali bloqueia a rolagem sozinho.
        "flex touch-manipulation cursor-grab flex-col gap-1.5 rounded-xl border border-veil/7 bg-card p-2.5 transition-colors select-none hover:border-veil/16 active:cursor-grabbing max-md:[-webkit-touch-callout:none]",
        isDragging && "z-10 border-primary/60 opacity-60 shadow-lg",
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
      </div>
    </div>
  );
}
