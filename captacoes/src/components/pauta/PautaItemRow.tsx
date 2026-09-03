"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Link2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PautaItem } from "@/types";

/**
 * Uma linha da agenda. Arrastar pelo grip reordena (dentro da pauta ou entre
 * pautas); clicar no texto edita no lugar; o chip de link abre a captação.
 */
export function PautaItemRow({
  item,
  posicao,
  onToggle,
  onRenomear,
  onExcluir,
}: {
  item: PautaItem;
  /** Número exibido antes do texto (1, 2, 3…) — é a sequência de gravação. */
  posicao: number;
  onToggle: (concluido: boolean) => void;
  onRenomear: (texto: string) => void;
  onExcluir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { tipo: "pauta-item", item },
  });
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(item.texto);
  const inputRef = useRef<HTMLInputElement>(null);

  // Realtime pode reescrever o texto enquanto a linha está parada na tela.
  useEffect(() => {
    if (!editando) setTexto(item.texto);
  }, [item.texto, editando]);

  useEffect(() => {
    if (editando) inputRef.current?.select();
  }, [editando]);

  function confirmar() {
    setEditando(false);
    const limpo = texto.trim();
    if (!limpo) {
      setTexto(item.texto); // vazio não apaga o item: desfaz a edição
      return;
    }
    if (limpo !== item.texto) onRenomear(limpo);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/item flex items-start gap-1.5 rounded-md px-1 py-1 transition-colors hover:bg-muted/60",
        isDragging && "opacity-40"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Arrastar item ${posicao}`}
        className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-0 outline-none transition-opacity group-hover/item:opacity-60 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Checkbox
        checked={item.concluido}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`Marcar "${item.texto}" como gravado`}
        className="mt-[3px]"
      />

      <div className="min-w-0 flex-1">
        {editando ? (
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={confirmar}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") {
                setTexto(item.texto);
                setEditando(false);
              }
            }}
            maxLength={500}
            className="w-full rounded border bg-background px-1 py-0.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="block w-full text-left text-xs leading-snug"
          >
            <span className="mr-1 font-semibold tabular-nums text-muted-foreground">{posicao}.</span>
            <span className={cn(item.concluido && "text-muted-foreground line-through")}>
              {item.texto}
            </span>
          </button>
        )}

        {item.captacao_id && !editando && (
          <Link
            href={`/captacao/${item.captacao_id}`}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <Link2 className="h-3 w-3" /> abrir captação
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={onExcluir}
        aria-label={`Remover "${item.texto}" da pauta`}
        className="mt-0.5 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover/item:opacity-60 focus-visible:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/**
 * Miniatura do item para o DragOverlay. É um componente à parte de propósito:
 * reusar o PautaItemRow registraria um segundo sortable com o mesmo id.
 */
export function PautaItemPreview({ item }: { item: PautaItem }) {
  return (
    <div className="flex max-w-xs items-center gap-1.5 rounded-md bg-card px-2 py-1.5 text-xs shadow-xl ring-2 ring-primary">
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{item.texto}</span>
    </div>
  );
}
