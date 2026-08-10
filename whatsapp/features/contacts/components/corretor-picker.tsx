"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignCorretorAction } from "@/app/contatos/actions";
import type { Corretor } from "@/types/corretor";
import type { ID } from "@/types/common";

const UNASSIGNED = "__none__";

/** Seletor do corretor responsável pelo contato. "Ninguém" desatribui. */
export function CorretorPicker({
  contactId,
  corretorId,
  corretores,
}: {
  contactId: ID;
  corretorId: string | null;
  corretores: Corretor[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string | null) {
    if (!value) return;
    const next = value === UNASSIGNED ? null : value;
    startTransition(async () => {
      try {
        await assignCorretorAction(contactId, next);
      } catch {
        toast.error("Não foi possível atribuir o responsável.");
      }
    });
  }

  // Sem rótulo próprio: quem rotula é a <FieldRow> de quem usa, para que este
  // campo alinhe com os outros da ficha em vez de trazer o "Responsável:"
  // colado no select.
  return (
    <Select value={corretorId ?? UNASSIGNED} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-auto">
        <SelectValue>
          {(value: string) =>
            value === UNASSIGNED
              ? "Ninguém"
              : (corretores.find((c) => c.id === value)?.nome ?? "—")
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Ninguém</SelectItem>
        {corretores.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
