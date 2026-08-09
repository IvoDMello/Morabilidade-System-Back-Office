"use client";

import { useState, useTransition } from "react";
import { Check, ListFilter, MoreVertical, Plus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TAG_COLOR_CLASSES, type TagColor } from "@/constants/tag-colors";
import { cn } from "@/lib/utils";
import { createListAction } from "@/app/conversas/actions";
import type { Tag } from "@/types/tag";
import type { Corretor } from "@/types/corretor";

/** Menu ⋮ da lista de conversas (sem seleção): novo grupo e filtros por
 * listas (etiquetas) e por corretor responsável, com criação de listas novas
 * — padrão WhatsApp Business. */
export function ChatListMenu({
  tags,
  activeTagId,
  onSelectTag,
  corretores,
  activeCorretorId,
  onSelectCorretor,
}: {
  tags: Tag[];
  activeTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  corretores: Corretor[];
  activeCorretorId: string | null;
  onSelectCorretor: (corretorId: string | null) => void;
}) {
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isPending, startTransition] = useTransition();

  function createList() {
    const name = newListName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const tag = await createListAction(name);
        onSelectTag(tag.id);
        setNewListName("");
        setNewListOpen(false);
        toast.success(`Lista "${tag.name}" criada.`);
      } catch {
        toast.error("Não foi possível criar a lista.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Mais opções" />}
        >
          <MoreVertical className="h-5 w-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() =>
              toast.info("Grupos ainda não são suportados pela API Cloud do WhatsApp.")
            }
          >
            <Users />
            Novo grupo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="w-full">
              <ListFilter />
              Listas
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filtrar conversas por lista</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onSelectTag(null)}>
                  <span className="h-2.5 w-2.5 rounded-full bg-veil/10" />
                  <span className="flex-1">Todas</span>
                  {activeTagId === null && <Check className="text-jade" />}
                </DropdownMenuItem>
                {tags.map((tag) => (
                  <DropdownMenuItem key={tag.id} onClick={() => onSelectTag(tag.id)}>
                    <span className={cn("h-2.5 w-2.5 rounded-full", TAG_COLOR_CLASSES[tag.color])} />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {activeTagId === tag.id && <Check className="text-jade" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNewListOpen(true)}>
                <Plus />
                Nova lista
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {corretores.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="w-full">
                <UserRound />
                Corretor
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Filtrar por responsável</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onSelectCorretor(null)}>
                    <span className="h-2.5 w-2.5 rounded-full bg-veil/10" />
                    <span className="flex-1">Todos</span>
                    {activeCorretorId === null && <Check className="text-jade" />}
                  </DropdownMenuItem>
                  {corretores.map((corretor) => (
                    <DropdownMenuItem
                      key={corretor.id}
                      onClick={() => onSelectCorretor(corretor.id)}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          TAG_COLOR_CLASSES[corretor.cor as TagColor] ?? "bg-veil/10",
                        )}
                      />
                      <span className="flex-1 truncate">{corretor.nome}</span>
                      {activeCorretorId === corretor.id && <Check className="text-jade" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova lista</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Nome da lista"
            placeholder="Nome da lista (ex.: Proprietários)"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createList();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewListOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={isPending || !newListName.trim()} onClick={createList}>
              Criar lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
