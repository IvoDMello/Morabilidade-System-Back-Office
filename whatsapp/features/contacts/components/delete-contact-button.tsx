"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteContactAction } from "@/app/contatos/actions";
import type { ID } from "@/types/common";

export function DeleteContactButton({ contactId, contactName }: { contactId: ID; contactName: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
      }
      title="Excluir contato"
      description={`Tem certeza que deseja excluir "${contactName}"? Isso também remove todas as anotações e lembretes vinculados.`}
      confirmLabel="Excluir"
      onConfirm={() => deleteContactAction(contactId)}
    />
  );
}
