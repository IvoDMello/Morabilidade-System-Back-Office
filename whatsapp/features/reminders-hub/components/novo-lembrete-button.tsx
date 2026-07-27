"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BellPlus, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CategoryBadge } from "@/features/contacts/components/category-badge";
import { formatPhone, cn } from "@/lib/utils";
import type { Contact } from "@/types/contact";

/**
 * Botão de "Novo lembrete" da própria aba Lembretes. Todo lembrete pertence a
 * um contato, então abre o mesmo seletor de contato usado na sidebar
 * (CommandPalette em modo reminder) e navega para o contato com
 * `?novoLembrete=1`, que dispara o diálogo de criação. Filtra client-side a
 * lista de contatos que a página já carregou — sem fetch extra.
 */
export function NovoLembreteButton({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contacts.slice(0, 8);
    const digits = term.replace(/\D/g, "");
    return contacts
      .filter((c) => {
        const nameHit = c.name.toLowerCase().includes(term);
        const phoneHit = digits.length > 0 && c.phone.replace(/\D/g, "").includes(digits);
        return nameHit || phoneHit;
      })
      .slice(0, 20);
  }, [contacts, query]);

  function openPicker() {
    setQuery("");
    setHighlighted(0);
    setOpen(true);
  }

  function goToContact(contact: Contact) {
    setOpen(false);
    router.push(`/contatos/${contact.id}?novoLembrete=1`);
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
    <>
      <button
        type="button"
        onClick={openPicker}
        className="flex items-center gap-1.5 rounded-lg bg-[#585a4f] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#42453a]"
      >
        <BellPlus className="h-4 w-4" strokeWidth={2} />
        Novo lembrete
      </button>

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
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Buscar contato para criar um lembrete…"
              className="h-8 border-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <BellPlus className="h-3.5 w-3.5" />
              Escolha o contato do lembrete
            </div>

            {results.length === 0 && (
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

          <div className="flex items-center gap-2 border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span>↑↓ navegar · Enter escolher · Esc fechar</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
