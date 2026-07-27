"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { CONTACT_STATUS_SOLID_BY_VALUE } from "@/constants/contact-status";
import type { ContactStatus } from "@/constants/contact-status";
import type { Contact } from "@/types/contact";
import { PipelineCard } from "./pipeline-card";

interface PipelineColumnProps {
  status: ContactStatus;
  label: string;
  contacts: Contact[];
}

export function PipelineColumn({ status, label, contacts }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[270px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-veil/6 bg-well transition-colors",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2 border-b border-veil/5 px-3.5 py-3">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: CONTACT_STATUS_SOLID_BY_VALUE[status] }}
        />
        <span className="text-[12.5px] font-semibold text-ink-strong">{label}</span>
        <span className="rounded-full bg-veil/6 px-[7px] py-px text-[11.5px] font-semibold text-muted-foreground">
          {contacts.length}
        </span>
      </div>
      <div className="flex min-h-16 flex-1 flex-col gap-2 p-2.5">
        {contacts.map((contact) => (
          <PipelineCard key={contact.id} contact={contact} />
        ))}
        {contacts.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">Nenhum contato</p>
        )}
      </div>
    </div>
  );
}
