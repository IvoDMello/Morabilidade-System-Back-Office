"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "@/app/contatos/actions";
import type { ID } from "@/types/common";

interface FavoriteToggleProps {
  contactId: ID;
  isFavorite: boolean;
  size?: "icon-sm" | "icon";
}

export function FavoriteToggle({ contactId, isFavorite, size = "icon-sm" }: FavoriteToggleProps) {
  const [optimistic, setOptimistic] = useState(isFavorite);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !optimistic;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await toggleFavoriteAction(contactId, next);
      } catch {
        setOptimistic(!next);
        toast.error("Não foi possível atualizar o favorito.");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size={size}
      disabled={isPending}
      onClick={handleClick}
      aria-label={optimistic ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={optimistic}
    >
      <Star
        className={cn(
          "h-4 w-4",
          optimistic ? "fill-gold text-gold" : "text-ink-ghost",
        )}
      />
    </Button>
  );
}
