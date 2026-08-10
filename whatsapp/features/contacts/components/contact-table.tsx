"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CategoryBadge } from "./category-badge";
import { StatusBadge } from "./status-badge";
import { FavoriteToggle } from "./favorite-toggle";
import { ContactRowActions } from "./contact-row-actions";
import { formatDateTime, formatPhone, cn, SUPERFICIE } from "@/lib/utils";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from "@/constants/contact-status";
import type { ContactStatus } from "@/constants/contact-status";
import {
  bulkDeleteAction,
  bulkSetFavoriteAction,
  bulkUpdateStatusAction,
} from "@/app/contatos/actions";
import type { Contact } from "@/types/contact";
import type { ID } from "@/types/common";

type SortableColumn = "name" | "updatedAt";

function SortableHeader({ column, children }: { column: SortableColumn; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSortBy = searchParams.get("sortBy") ?? "updatedAt";
  const activeSortDir = searchParams.get("sortDir") ?? (activeSortBy === "name" ? "asc" : "desc");
  const isActive = activeSortBy === column;

  const nextDir = isActive && activeSortDir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams(searchParams.toString());
  params.set("sortBy", column);
  params.set("sortDir", nextDir);

  const Icon = !isActive ? ArrowUpDown : activeSortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        isActive && "text-foreground",
      )}
    >
      {children}
      <Icon className={cn("h-3.5 w-3.5", !isActive && "opacity-40")} />
    </Link>
  );
}

export function ContactTable({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum contato encontrado"
        description="Ajuste os filtros ou cadastre um novo contato."
      />
    );
  }

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(contacts.map((c) => c.id)) : new Set());
  }

  function toggleOne(id: ID, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function runBulkAction(action: () => Promise<void>, successMessage: string) {
    const ids = Array.from(selected);
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        clearSelection();
        router.refresh();
      } catch {
        toast.error("Não foi possível concluir a ação em lote.");
      }
    });
    return ids;
  }

  function handleBulkStatus(status: ContactStatus) {
    const ids = Array.from(selected);
    runBulkAction(
      () => bulkUpdateStatusAction(ids, status),
      `Status atualizado para ${ids.length} contato${ids.length === 1 ? "" : "s"}.`,
    );
  }

  function handleBulkFavorite() {
    const ids = Array.from(selected);
    runBulkAction(
      () => bulkSetFavoriteAction(ids, true),
      `${ids.length} contato${ids.length === 1 ? "" : "s"} favoritado${ids.length === 1 ? "" : "s"}.`,
    );
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    if (!window.confirm(`Excluir ${ids.length} contato${ids.length === 1 ? "" : "s"} selecionado${ids.length === 1 ? "" : "s"}? Essa ação não pode ser desfeita.`)) {
      return;
    }
    runBulkAction(
      () => bulkDeleteAction(ids),
      `${ids.length} contato${ids.length === 1 ? "" : "s"} excluído${ids.length === 1 ? "" : "s"}.`,
    );
  }

  return (
    <>
      {/* Desktop/tablet: tabela */}
      <div className="hidden overflow-x-auto rounded-2xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead />
              <TableHead>
                <SortableHeader column="name">Nome</SortableHeader>
              </TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <SortableHeader column="updatedAt">Atualizado em</SortableHeader>
              </TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id} data-state={selected.has(contact.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(contact.id)}
                    onCheckedChange={(checked) => toggleOne(contact.id, checked === true)}
                    aria-label={`Selecionar ${contact.name}`}
                  />
                </TableCell>
                <TableCell>
                  <FavoriteToggle contactId={contact.id} isFavorite={contact.isFavorite} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <AvatarInitials name={contact.name} size="sm" />
                    <Link
                      href={`/contatos/${contact.id}`}
                      className="font-medium hover:underline active:text-gold"
                    >
                      {contact.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatPhone(contact.phone)}</TableCell>
                <TableCell>
                  <CategoryBadge category={contact.category} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={contact.status} />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDateTime(contact.updatedAt)}
                </TableCell>
                <TableCell>
                  <ContactRowActions contactId={contact.id} contactName={contact.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {contacts.map((contact) => (
          <div key={contact.id} className={cn(SUPERFICIE, "p-4")}>
            <div className="flex items-start gap-2.5">
              <AvatarInitials name={contact.name} size="sm" />
              {/* Nome e telefone num bloco só, alinhados à direita do avatar —
                  soltos, o telefone voltava para a margem do cartão e a dupla
                  deixava de ser lida como uma coisa só. */}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <Link
                    href={`/contatos/${contact.id}`}
                    className="truncate font-medium hover:underline active:text-gold"
                  >
                    {contact.name}
                  </Link>
                  <FavoriteToggle
                    contactId={contact.id}
                    isFavorite={contact.isFavorite}
                    size="icon-sm"
                  />
                </div>
                <p className="text-sm font-medium tabular-nums text-jade">
                  {formatPhone(contact.phone)}
                </p>
              </div>
              <ContactRowActions contactId={contact.id} contactName={contact.name} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={contact.category} />
              <StatusBadge status={contact.status} />
            </div>
            {/* Divisor antes do carimbo de tempo: ele é metadado do cartão, não
                mais um dado do contato na mesma pilha. */}
            <p className="mt-3 border-t pt-2.5 text-xs tabular-nums text-muted-foreground">
              Atualizado em {formatDateTime(contact.updatedAt)}
            </p>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-4 md:bottom-6">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-popover px-3 py-2 shadow-lg ring-1 ring-foreground/10">
            <span className="px-1 text-sm font-medium">
              {selected.size} selecionado{selected.size === 1 ? "" : "s"}
            </span>
            <Select onValueChange={(value) => handleBulkStatus(value as ContactStatus)}>
              <SelectTrigger className="h-8 w-44" disabled={isPending}>
                <SelectValue placeholder="Mudar status">
                  {() => "Mudar status"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {CONTACT_STATUS_LABELS[s.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={isPending} onClick={handleBulkFavorite}>
              <Star className="h-4 w-4" />
              Favoritar
            </Button>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
            <Button variant="ghost" size="sm" disabled={isPending} onClick={clearSelection}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
