"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteContactAction } from "@/app/contatos/actions";
import type { ID } from "@/types/common";

export function ContactRowActions({ contactId, contactName }: { contactId: ID; contactName: string }) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        render={<Link href={`/contatos/${contactId}/editar`} aria-label="Editar contato" />}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon" aria-label="Excluir contato">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        }
        title="Excluir contato"
        description={`Tem certeza que deseja excluir "${contactName}"? Isso também remove todas as anotações e lembretes vinculados.`}
        confirmLabel="Excluir"
        onConfirm={() => deleteContactAction(contactId)}
      />
    </div>
  );
}
