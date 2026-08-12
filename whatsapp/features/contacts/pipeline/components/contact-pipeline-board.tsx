"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { CONTACT_STATUSES, type ContactStatus } from "@/constants/contact-status";
import type { LossReason } from "@/constants/loss-reasons";
import { updateContactStatusAction } from "@/app/contatos/actions";
import { LossReasonDialog } from "@/features/contacts/components/loss-reason-dialog";
import type { Contact } from "@/types/contact";
import type { ID } from "@/types/common";
import { PipelineColumn } from "./pipeline-column";
import { TopScrollbar } from "./top-scrollbar";

export function ContactPipelineBoard({
  contacts,
  statusFiltro,
}: {
  contacts: Contact[];
  /** Status escolhido na barra de filtros. Com ele, o board mostra só a coluna
   * correspondente — filtrar por "Documentação" e continuar vendo sete colunas
   * (seis delas vazias) não é filtrar, é pintar de cinza. */
  statusFiltro?: ContactStatus;
}) {
  const [items, setItems] = useState(contacts);
  const [prevContacts, setPrevContacts] = useState(contacts);
  const [, startTransition] = useTransition();
  const [pendingContactId, setPendingContactId] = useState<ID | null>(null);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Ressincroniza com os dados do servidor quando `contacts` muda (nova busca/filtro
  // ou revalidação após mutação), sem perder o padrão "estado derivado durante o render".
  if (contacts !== prevContacts) {
    setPrevContacts(contacts);
    setItems(contacts);
  }

  // Mouse e dedo pedem gestos diferentes. Com um PointerSensor só, qualquer
  // deslize de 8px sobre um cartão virava arrasto — e como o board rola na
  // horizontal, sobrava rolar pelo vão entre as colunas: errar o alvo por um
  // centímetro movia o contato de etapa. No toque o arrasto agora começa
  // depois de segurar; deslizar antes disso (tolerance) cancela e a rolagem
  // segue normal.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const byStatus = useMemo(() => {
    const map = new Map<ContactStatus, Contact[]>(CONTACT_STATUSES.map((s) => [s.value, []]));
    for (const contact of items) {
      map.get(contact.status)?.push(contact);
    }
    return map;
  }, [items]);

  const colunas = statusFiltro
    ? CONTACT_STATUSES.filter((s) => s.value === statusFiltro)
    : CONTACT_STATUSES;

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
        {/* O gesto de mover ficou invisível no celular — sem uma linha de
            ajuda, "segurar" é uma regra que só se descobre por acidente. Com
            uma etapa só na tela não há para onde arrastar, então a dica seria
            uma instrução impossível de seguir. */}
        {!statusFiltro && (
          <p className="px-0.5 pb-2 text-xs text-muted-foreground md:hidden">
            Deslize para ver as etapas. Segure um cartão para mover de etapa.
          </p>
        )}
        {statusFiltro && (
          <p className="px-0.5 pb-2 text-xs text-muted-foreground">
            Filtrado por uma etapa. Para mover contatos entre etapas, limpe o
            filtro de status.
          </p>
        )}
        <TopScrollbar targetRef={boardRef} />
        <div
          ref={boardRef}
          className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 md:pb-0 md:[&::-webkit-scrollbar]:hidden md:[scrollbar-width:none]"
        >
          {colunas.map((s) => (
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
