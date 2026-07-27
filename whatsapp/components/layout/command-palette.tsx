"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, BellRing, UserPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { formatPhone, cn } from "@/lib/utils";
import { searchContactsAction } from "@/app/contatos/actions";
import type { Contact } from "@/types/contact";

/** Modo "reminder" leva ao contato com `?novoLembrete=1`, abrindo o diálogo de lembrete. */
type PaletteMode = "navigate" | "reminder";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
  );
}

/**
 * Busca global + criação rápida da sidebar (SB-1). A busca abre com o botão,
 * ⌘K/Ctrl+K de qualquer lugar, ou "/" fora de campos editáveis. "Novo lembrete"
 * reusa o mesmo diálogo em modo de escolha de contato, já que todo lembrete
 * pertence a um contato.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("navigate");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Contact[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  const openPalette = useCallback((nextMode: PaletteMode) => {
    setMode(nextMode);
    setQuery("");
    setResults([]);
    setHighlighted(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette("navigate");
        return;
      }
      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        openPalette("navigate");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openPalette]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const found = await searchContactsAction(term);
        if (requestId.current === id) {
          setResults(found);
          setHighlighted(0);
        }
      });
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  function goToContact(contact: Contact) {
    setOpen(false);
    if (mode === "reminder") {
      router.push(`/contatos/${contact.id}?novoLembrete=1`);
    } else {
      router.push(`/contatos/${contact.id}`);
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && results[highlighted]) {
      event.preventDefault();
      goToContact(results[highlighted]);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => openPalette("navigate")}
        title="Buscar (⌘K)"
        aria-label="Buscar contato"
        className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-dim transition-colors hover:bg-veil/6 hover:text-ink-mid"
      >
        <Search className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              title="Novo"
              aria-label="Criar novo"
              className="flex h-10 w-10 items-center justify-center rounded-[10px] text-gold transition-colors hover:bg-sidebar-accent"
            />
          }
        >
          <Plus className="h-[19px] w-[19px]" strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-56">
          <DropdownMenuItem
            render={<a href="/contatos/novo" />}
          >
            <UserPlus className="h-4 w-4" />
            Novo contato
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openPalette("reminder")}>
            <BellRing className="h-4 w-4" />
            Novo lembrete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-[20%] max-w-lg translate-y-0 gap-0 p-0 sm:max-w-lg"
          showCloseButton={false}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={
                mode === "reminder"
                  ? "Buscar contato para criar um lembrete…"
                  : "Buscar contato por nome ou telefone…"
              }
              className="h-8 border-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            {mode === "reminder" && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <BellRing className="h-3.5 w-3.5" />
                Escolha o contato do lembrete
              </div>
            )}

            {!query.trim() && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                Digite um nome, telefone ou e-mail.
              </p>
            )}

            {query.trim() && !isPending && results.length === 0 && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                Nenhum contato encontrado.
              </p>
            )}

            {results.map((contact, index) => (
              <button
                key={contact.id}
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => goToContact(contact)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                  index === highlighted && "bg-accent",
                )}
              >
                <AvatarInitials name={contact.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{contact.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatPhone(contact.phone)}
                  </span>
                </span>
                <CategoryBadge category={contact.category} />
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span>↑↓ navegar · Enter abrir · Esc fechar</span>
            <a
              href="/contatos/novo"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Novo contato
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
