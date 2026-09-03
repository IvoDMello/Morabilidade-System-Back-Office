"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, Check, GripVertical, Pencil, Trash2, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PautaItemRow } from "./PautaItemRow";
import { AdicionarItem } from "./AdicionarItem";
import { PautaDialog, type PautaDados } from "./PautaDialog";
import { cn } from "@/lib/utils";
import { dataCurta } from "@/lib/format";
import { progresso, rotuloData, diasAteData } from "@/lib/pauta";
import { usePauta } from "@/stores/pauta";
import { usePautaAcoes } from "@/lib/usePautaAcoes";
import type { Pauta } from "@/types";

/**
 * Cartão da raia: título, dia previsto e a sequência ordenada de gravação.
 *
 * O cartão inteiro é sortable (pega pelo grip) e ao mesmo tempo droppable,
 * para receber itens de outra pauta e captações arrastadas do quadro.
 */
export function PautaCard({ pauta }: { pauta: Pauta }) {
  const itens = usePauta((s) => s.itens[pauta.id]) ?? [];
  const acoes = usePautaAcoes();
  const [editando, setEditando] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pauta.id,
    data: { tipo: "pauta", pauta },
  });
  // Alvo de soltura separado do sortable: recebe itens e captações mesmo
  // quando a lista de itens está vazia.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `pauta-drop:${pauta.id}`,
    data: { tipo: "pauta-drop", pautaId: pauta.id },
  });

  const { feitos, total } = progresso(itens);
  const atrasada = pauta.data_alvo ? diasAteData(pauta.data_alvo) < 0 : false;
  const hoje = pauta.data_alvo ? diasAteData(pauta.data_alvo) === 0 : false;

  async function salvarEdicao(dados: PautaDados) {
    await acoes.editar(pauta, dados);
  }

  return (
    <>
      <Card
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn(
          "group/pauta border-l-4 p-2.5 text-sm transition-shadow hover:shadow-md",
          pauta.concluida ? "border-l-positive opacity-70" : "border-l-primary",
          isDragging && "opacity-40",
          isOver && "ring-2 ring-primary/60"
        )}
      >
        <div className="flex items-start gap-1.5">
          <button
            {...attributes}
            {...listeners}
            aria-label={`Arrastar pauta ${pauta.titulo}`}
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-40 outline-none transition-opacity hover:bg-muted group-hover/pauta:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-medium leading-snug",
                pauta.concluida && "text-muted-foreground line-through"
              )}
            >
              {pauta.titulo}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              {pauta.data_alvo && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium",
                    atrasada
                      ? "bg-destructive/10 text-destructive"
                      : hoje
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  <CalendarDays className="h-3 w-3" />
                  {dataCurta(`${pauta.data_alvo}T00:00:00`)} · {rotuloData(pauta.data_alvo)}
                </span>
              )}
              {total > 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium tabular-nums text-muted-foreground">
                  {feitos}/{total} gravados
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/pauta:opacity-100 focus-within:opacity-100">
            <IconBtn
              titulo={pauta.concluida ? "Reabrir pauta" : "Concluir pauta"}
              onClick={() => acoes.concluir(pauta, !pauta.concluida)}
            >
              {pauta.concluida ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn titulo="Editar pauta" onClick={() => setEditando(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn titulo="Excluir pauta" destrutivo onClick={() => acoes.excluir(pauta)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>

        {pauta.descricao && (
          <p className="mt-1.5 whitespace-pre-line pl-6 text-xs text-muted-foreground">
            {pauta.descricao}
          </p>
        )}

        <div ref={setDropRef} className="mt-2">
          <SortableContext items={itens.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-0.5">
              {itens.map((item, i) => (
                <PautaItemRow
                  key={item.id}
                  item={item}
                  posicao={i + 1}
                  onToggle={(concluido) => acoes.alterarItem(item, { concluido })}
                  onRenomear={(texto) => acoes.alterarItem(item, { texto })}
                  onExcluir={() => acoes.excluirItem(item)}
                />
              ))}
            </ul>
          </SortableContext>

          {itens.length === 0 && (
            <p
              className={cn(
                "rounded-md border border-dashed px-2 py-2 text-center text-[11px] transition-colors",
                isOver ? "border-primary/50 bg-primary/5 text-primary" : "text-muted-foreground"
              )}
            >
              {isOver ? "Solte aqui" : "Arraste captações para cá ou escreva abaixo"}
            </p>
          )}

          <div className="mt-1.5">
            <AdicionarItem
              onAdicionar={(texto, captacaoId) => acoes.adicionarItem(pauta.id, texto, captacaoId)}
            />
          </div>
        </div>
      </Card>

      <PautaDialog open={editando} pauta={pauta} onSalvar={salvarEdicao} onOpenChange={setEditando} />
    </>
  );
}

function IconBtn({
  titulo,
  onClick,
  destrutivo = false,
  children,
}: {
  titulo: string;
  onClick: () => void;
  destrutivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-muted",
        destrutivo && "hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Miniatura da pauta para o DragOverlay — separada do PautaCard para não
 * registrar um segundo sortable/droppable com os mesmos ids durante o arrasto.
 */
export function PautaCardPreview({ pauta, itens }: { pauta: Pauta; itens: number }) {
  return (
    <Card className="w-72 rotate-1 border-l-4 border-l-primary p-2.5 text-sm shadow-xl ring-2 ring-primary">
      <p className="font-medium leading-snug">{pauta.titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {itens} {itens === 1 ? "item" : "itens"}
      </p>
    </Card>
  );
}
