"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  Ban,
  BellOff,
  BellPlus,
  BellRing,
  Building2,
  History,
  MessageCircle,
  Send,
  Tag,
  UserPlus,
} from "lucide-react";
import { isToday, isYesterday } from "date-fns";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { NoteForm } from "@/features/contacts/notes/components/note-form";
import type { ContactNote } from "@/types/note";
import type { ContactEvent, ContactEventType } from "@/types/event";
import type { WhatsAppMessage } from "@/types/whatsapp";
import type { ID } from "@/types/common";

const EVENT_ICONS: Record<ContactEventType, LucideIcon> = {
  contact_created: UserPlus,
  status_changed: ArrowRightLeft,
  reminder_created: BellPlus,
  reminder_completed: BellRing,
  reminder_cancelled: BellOff,
  tag_added: Tag,
  tag_removed: Tag,
  property_linked: Building2,
  property_stage_changed: Building2,
  property_unlinked: Building2,
  property_relation_changed: Building2,
  contact_blocked: Ban,
  contact_unblocked: Ban,
  contact_assigned: UserPlus,
};

type TimelineItem =
  | { kind: "note"; createdAt: string; note: ContactNote }
  | { kind: "event"; createdAt: string; event: ContactEvent }
  | { kind: "message"; createdAt: string; message: WhatsAppMessage };

type FeedFilter = "all" | "messages" | "notes";

const FILTERS: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "messages", label: "Mensagens" },
  { value: "notes", label: "Anotações" },
];

function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return formatDate(date);
}

interface ActivityFeedProps {
  contactId: ID;
  notes: ContactNote[];
  events: ContactEvent[];
  messages: WhatsAppMessage[];
}

/**
 * Atividade unificada da ficha (FC-1/FC-2): substitui as abas "Visão geral" /
 * "Conversa" — que duplicavam Lembretes/Anotações inteiros — por um único feed
 * filtrável, com divisores de data.
 *
 * Aqui não se envia mensagem. Antes havia o composer do WhatsApp no rodapé e a
 * anotação escondida atrás de um botão só de ícone: quem escrevia no campo
 * grande mandava mensagem para o cliente achando que estava registrando uma
 * observação interna. Mensagem se manda com a conversa aberta, onde se lê o
 * histórico antes de falar — daí o link para o inbox.
 *
 * O campo de anotação só existe sob o filtro "Anotações"; em "Tudo" e
 * "Mensagens" o rodapé é só o link. É a mesma regra de novo: campo de texto
 * embaixo de uma lista de mensagens é lido como resposta ao cliente, dê o
 * rótulo que der.
 */
export function ActivityFeed({ contactId, notes, events, messages }: ActivityFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>("all");

  const items = useMemo(() => {
    const all: TimelineItem[] = [
      ...notes.map((note): TimelineItem => ({ kind: "note", createdAt: note.createdAt, note })),
      ...events.map((event): TimelineItem => ({ kind: "event", createdAt: event.createdAt, event })),
      ...messages.map(
        (message): TimelineItem => ({ kind: "message", createdAt: message.waTimestamp, message }),
      ),
    ];
    const filtered =
      filter === "messages"
        ? all.filter((i) => i.kind === "message")
        : filter === "notes"
          ? all.filter((i) => i.kind === "note")
          : all;
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, events, messages, filter]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhum registro ainda"
            description="Anotações, mensagens e eventos automáticos do sistema aparecem aqui em ordem cronológica."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => {
              const previous = items[index - 1];
              const showDivider =
                !previous || dateGroupLabel(previous.createdAt) !== dateGroupLabel(item.createdAt);

              return (
                <li key={`${item.kind}-${"note" in item ? item.note.id : "event" in item ? item.event.id : item.message.id}`}>
                  {showDivider && (
                    <div className="my-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {dateGroupLabel(item.createdAt)}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  {item.kind === "note" && (
                    <div className="rounded-lg border bg-card p-3">
                      <p className="whitespace-pre-wrap text-sm">{item.note.note}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.note.createdBy} · {formatDateTime(item.note.createdAt)}
                      </p>
                    </div>
                  )}

                  {item.kind === "message" && (
                    <div className="flex items-start gap-2 px-1 text-sm text-muted-foreground">
                      {item.message.direction === "outbound" ? (
                        <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      <p className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">
                          {item.message.direction === "outbound"
                            ? "Mensagem enviada: "
                            : "Mensagem recebida: "}
                        </span>
                        <span>{item.message.body}</span>
                        <span className="ml-1.5 text-xs">
                          · {formatDateTime(item.message.waTimestamp)}
                        </span>
                      </p>
                    </div>
                  )}

                  {item.kind === "event" &&
                    (() => {
                      const Icon = EVENT_ICONS[item.event.type];
                      return (
                        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.event.summary}</span>
                          <span className="text-xs">· {formatDateTime(item.event.createdAt)}</span>
                        </div>
                      );
                    })()}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          {filter === "notes" ? (
            <p className="text-xs font-medium text-muted-foreground">
              Nova anotação{" "}
              <span className="font-normal">— só a equipe vê, o contato não recebe nada</span>
            </p>
          ) : (
            <span />
          )}
          <Link
            href={`/?c=${contactId}`}
            className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Abrir conversa
          </Link>
        </div>
        {filter === "notes" && <NoteForm contactId={contactId} />}
      </div>
    </div>
  );
}
