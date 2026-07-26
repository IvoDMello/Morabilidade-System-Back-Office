"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { CONTACT_STATUSES, type ContactStatus } from "@/constants/contact-status";
import type { LossReason } from "@/constants/loss-reasons";
import { updateContactStatusAction } from "@/app/contatos/actions";
import { LossReasonDialog } from "@/features/contacts/components/loss-reason-dialog";
import type { Contact } from "@/types/contact";
import type { ID } from "@/types/common";
import { PipelineColumn } from "./pipeline-column";

export function ContactPipelineBoard({ contacts }: { contacts: Contact[] }) {
  const [items, setItems] = useState(contacts);
  const [prevContacts, setPrevContacts] = useState(contacts);
  const [, startTransition] = useTransition();
  const [pendingContactId, setPendingContactId] = useState<ID | null>(null);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);

  // Ressincroniza com os dados do servidor quando `contacts` muda (nova busca/filtro
  // ou revalidação após mutação), sem perder o padrão "estado derivado durante o render".
  if (contacts !== prevContacts) {
    setPrevContacts(contacts);
    setItems(contacts);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const byStatus = useMemo(() => {
    const map = new Map<ContactStatus, Contact[]>(CONTACT_STATUSES.map((s) => [s.value, []]));
    for (const contact of items) {
      map.get(contact.status)?.push(contact);
    }
    return map;
  }, [items]);

  function moveContact(
    contactId: ID,
    newStatus: ContactStatus,
    lossPayload?: { lossReason: LossReason | null; lossReasonNote: string | null },
  ) {
    const previous = items;
    setItems((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: newStatus, ...lossPayload } : c)),
    );
    startTransition(async () => {
      try {
        await updateContactStatusAction(
          contactId,
          newStatus,
          lossPayload?.lossReason,
          lossPayload?.lossReasonNote,
        );
      } catch {
        setItems(previous);
        toast.error("Não foi possível mover o contato.");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const contactId = event.active.id as ID;
    const newStatus = event.over?.id as ContactStatus | undefined;
    if (!newStatus) return;

    const contact = items.find((c) => c.id === contactId);
    if (!contact || contact.status === newStatus) return;

    if (newStatus === "perdido") {
      setPendingContactId(contactId);
      setLossDialogOpen(true);
      return;
    }

    moveContact(
      contactId,
      newStatus,
      contact.status === "perdido" ? { lossReason: null, lossReasonNote: null } : undefined,
    );
  }

  function handleLossConfirm(reason: LossReason, note: string | null) {
    if (!pendingContactId) return;
    moveContact(pendingContactId, "perdido", { lossReason: reason, lossReasonNote: note });
    setPendingContactId(null);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {CONTACT_STATUSES.map((s) => (
            <PipelineColumn
              key={s.value}
              status={s.value}
              label={s.label}
              contacts={byStatus.get(s.value) ?? []}
            />
          ))}
        </div>
      </DndContext>

      <LossReasonDialog
        open={lossDialogOpen}
        onOpenChange={(open) => {
          setLossDialogOpen(open);
          if (!open) setPendingContactId(null);
        }}
        onConfirm={handleLossConfirm}
      />
    </>
  );
}
