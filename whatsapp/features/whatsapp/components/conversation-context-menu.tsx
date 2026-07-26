"use client";

import { useState, useTransition } from "react";
import {
  Ban,
  Check,
  Eraser,
  Mail,
  MailOpen,
  Plus,
  Star,
  StarOff,
  Tag as TagIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TAG_COLOR_CLASSES } from "@/constants/tag-colors";
import { cn } from "@/lib/utils";
import {
  clearConversationAction,
  markConversationReadAction,
  markConversationUnreadAction,
  setContactBlockedAction,
} from "@/app/conversas/actions";
import {
  addTagToContactAction,
  createTagAction,
  removeTagFromContactAction,
  toggleFavoriteAction,
} from "@/app/contatos/actions";
import type { Tag } from "@/types/tag";
import type { WhatsAppConversationSummary } from "@/types/whatsapp";

/** Menu de contexto da conversa (padrão WhatsApp: segurar pressionado no
 * touch ou botão direito no desktop) — as opções abrem direto no gesto:
 * marcar como não lida, favoritar, etiquetar, limpar conversa e bloquear. */
export function ConversationContextMenu({
  conversation,
  allTags,
  children,
}: {
  conversation: WhatsAppConversationSummary;
  allTags: Tag[];
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const contactId = conversation.contactId;
  const hasUnread = conversation.unreadCount > 0;

  function run(action: () => Promise<unknown>, errorMessage: string) {
    startTransition(async () => {
      try {
        await action();
      } catch {
        toast.error(errorMessage);
      }
    });
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="block transition-colors data-popup-open:bg-primary/10">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={() =>
              run(
                () =>
                  hasUnread
                    ? markConversationReadAction(contactId)
                    : markConversationUnreadAction(contactId),
                "Não foi possível atualizar a conversa.",
              )
            }
          >
            {hasUnread ? <MailOpen /> : <Mail />}
            {hasUnread ? "Marcar como lida" : "Marcar como não lida"}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() =>
              run(
                () => toggleFavoriteAction(contactId, !conversation.contactIsFavorite),
                "Não foi possível atualizar os favoritos.",
              )
            }
          >
            {conversation.contactIsFavorite ? <StarOff /> : <Star />}
            {conversation.contactIsFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setTagsDialogOpen(true)}>
            <TagIcon />
            Atribuir etiqueta
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setClearDialogOpen(true)}>
            <Eraser />
            Limpar conversa
          </ContextMenuItem>
          {conversation.contactIsBlocked ? (
            <ContextMenuItem
              onClick={() =>
                run(
                  () => setContactBlockedAction(contactId, false),
                  "Não foi possível desbloquear o contato.",
                )
              }
            >
              <Undo2 />
              Desbloquear
            </ContextMenuItem>
          ) : (
            <ContextMenuItem variant="destructive" onClick={() => setBlockDialogOpen(true)}>
              <Ban />
              Bloquear
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <AssignTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        contactId={contactId}
        contactTagIds={conversation.contactTagIds}
        allTags={allTags}
      />

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar esta conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens de {conversation.contactName} serão apagadas do painel. Essa
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await clearConversationAction(contactId);
                    setClearDialogOpen(false);
                  } catch {
                    toast.error("Não foi possível limpar a conversa.");
                  }
                });
              }}
            >
              Limpar conversa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear {conversation.contactName}?</AlertDialogTitle>
            <AlertDialogDescription>
              O envio de mensagens para este contato fica desativado até você desbloquear.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await setContactBlockedAction(contactId, true);
                    setBlockDialogOpen(false);
                  } catch {
                    toast.error("Não foi possível bloquear o contato.");
                  }
                });
              }}
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Dialog de etiquetas do contato — replica o TagPicker da ficha, mas a
 * partir da lista de conversas (marca/desmarca e cria etiqueta nova). */
function AssignTagsDialog({
  open,
  onOpenChange,
  contactId,
  contactTagIds,
  allTags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactTagIds: string[];
  allTags: Tag[];
}) {
  const [isPending, startTransition] = useTransition();
  // Estado otimista local: o revalidatePath atualiza o servidor, mas a
  // resposta demora um ciclo — o Set evita checkbox "voltando" ao clicar.
  const [optimisticIds, setOptimisticIds] = useState<Set<string> | null>(null);
  const [newTagName, setNewTagName] = useState("");

  const checkedIds = optimisticIds ?? new Set(contactTagIds);

  function toggleTag(tag: Tag) {
    const isChecked = checkedIds.has(tag.id);
    const next = new Set(checkedIds);
    if (isChecked) next.delete(tag.id);
    else next.add(tag.id);
    setOptimisticIds(next);

    startTransition(async () => {
      try {
        if (isChecked) await removeTagFromContactAction(contactId, tag.id);
        else await addTagToContactAction(contactId, tag.id);
      } catch {
        setOptimisticIds(checkedIds);
        toast.error("Não foi possível atualizar a etiqueta.");
      }
    });
  }

  function createAndAssign() {
    const name = newTagName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const tag = await createTagAction(contactId, { name });
        setOptimisticIds(new Set([...checkedIds, tag.id]));
        setNewTagName("");
      } catch {
        toast.error("Não foi possível criar a etiqueta.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOptimisticIds(null);
          setNewTagName("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atribuir etiqueta</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {allTags.map((tag) => {
            const isChecked = checkedIds.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                disabled={isPending}
                onClick={() => toggleTag(tag)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", TAG_COLOR_CLASSES[tag.color])} />
                <span className="flex-1 truncate">{tag.name}</span>
                {isChecked && <Check className="h-4 w-4 text-jade" />}
              </button>
            );
          })}
          {allTags.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma etiqueta ainda.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nova etiqueta..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndAssign();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Criar etiqueta"
            disabled={isPending || !newTagName.trim()}
            onClick={createAndAssign}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
