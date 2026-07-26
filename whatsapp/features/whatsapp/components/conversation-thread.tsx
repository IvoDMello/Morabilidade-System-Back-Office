"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { isToday, isYesterday } from "date-fns";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { markConversationReadAction } from "@/app/conversas/actions";
import { MessageStatusIcon } from "./message-status-icon";
import type { ID } from "@/types/common";
import type { WhatsAppMessage } from "@/types/whatsapp";

const POLL_INTERVAL_MS = 4000;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return formatDate(date);
}

/** Agrupa por dia e, dentro do dia, por sequências consecutivas do mesmo
 * remetente (CV-2) — menos respiro entre bolhas da mesma pessoa, timestamp só
 * na última mensagem do grupo. */
function groupMessages(messages: WhatsAppMessage[]) {
  const days: { label: string; clusters: WhatsAppMessage[][] }[] = [];

  for (const message of messages) {
    const label = dayLabel(message.waTimestamp);
    let day = days[days.length - 1];
    if (!day || day.label !== label) {
      day = { label, clusters: [] };
      days.push(day);
    }
    const lastCluster = day.clusters[day.clusters.length - 1];
    if (lastCluster && lastCluster[0].direction === message.direction) {
      lastCluster.push(message);
    } else {
      day.clusters.push([message]);
    }
  }

  return days;
}

export function ConversationThread({
  contactId,
  messages,
}: {
  contactId: ID;
  messages: WhatsAppMessage[];
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    markConversationReadAction(contactId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-well/50 p-6">
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma mensagem ainda"
          description="Quando o contato escrever no WhatsApp, a conversa aparece aqui."
        />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="font-chat flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-well/50 px-3 py-4 md:px-5"
    >
      {days.map((day) => (
        <div key={day.label} className="flex flex-col gap-3">
          <div className="flex justify-center">
            <span className="rounded-full bg-veil/4 px-3 py-1 text-[11px] uppercase tracking-[0.02em] text-ink-faint">
              {day.label}
            </span>
          </div>

          {day.clusters.map((cluster) => {
            const isOutbound = cluster[0].direction === "outbound";
            return (
              <div
                key={cluster[0].id}
                className={cn("flex flex-col gap-0.5", isOutbound ? "items-end" : "items-start")}
              >
                {cluster.map((message, index) => {
                  const isLast = index === cluster.length - 1;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[75%] rounded-[14px] border px-3 py-2 text-sm",
                        isOutbound
                          ? "rounded-br-[4px] border-bubble-out-line bg-bubble-out text-bubble-out-fg"
                          : "rounded-bl-[4px] border-veil/5 bg-bubble-in text-bubble-in-fg",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      {isLast && (
                        <div
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[0.7rem] tabular-nums",
                            isOutbound ? "text-bubble-out-meta" : "text-ink-faint",
                          )}
                        >
                          {formatDateTime(message.waTimestamp)}
                          {isOutbound && <MessageStatusIcon status={message.status} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
