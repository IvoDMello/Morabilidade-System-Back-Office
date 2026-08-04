"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { isToday, isYesterday } from "date-fns";
import { Download, FileText, MessageCircle, Reply } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { mediaLabel, mediaSrc, messagePreview } from "@/lib/whatsapp-media";
import { markConversationReadAction } from "@/app/conversas/actions";
import { useReply } from "@/features/whatsapp/reply-context";
import { MessageStatusIcon } from "./message-status-icon";
import type { ID } from "@/types/common";
import type { WhatsAppMessage } from "@/types/whatsapp";

/** Elemento visual da mídia (foto/áudio/vídeo/documento/figurinha) de uma mensagem. */
function MediaElement({ message }: { message: WhatsAppMessage }) {
  const src = mediaSrc(message);
  if (!src) {
    return (
      <p className="text-xs italic text-ink-faint">{mediaLabel(message.messageType)} · indisponível</p>
    );
  }

  switch (message.messageType) {
    case "image":
    case "sticker":
      return (
        <a href={src} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- mídia servida pelo proxy/URL externa, não pelo otimizador do Next */}
          <img
            src={src}
            alt={message.mediaFilename ?? "Imagem recebida"}
            loading="lazy"
            className={cn(
              "rounded-lg object-cover",
              message.messageType === "sticker" ? "max-h-32 w-32" : "max-h-80 w-auto",
            )}
          />
        </a>
      );
    case "video":
      return <video src={src} controls preload="metadata" className="max-h-80 rounded-lg" />;
    case "audio":
      return <audio src={src} controls preload="metadata" className="w-56 max-w-full" />;
    case "document":
      return (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          download={message.mediaFilename ?? undefined}
          className="flex items-center gap-2 rounded-lg border border-veil/10 bg-veil/4 px-3 py-2 hover:bg-veil/8"
        >
          <FileText className="h-5 w-5 shrink-0 text-jade" />
          <span className="min-w-0 truncate">{message.mediaFilename ?? "Documento"}</span>
          <Download className="h-4 w-4 shrink-0 opacity-60" />
        </a>
      );
    default:
      return <p className="text-xs italic text-ink-faint">{mediaLabel(message.messageType)}</p>;
  }
}

/** Corpo da bolha: texto puro, ou mídia + legenda opcional. */
function MessageBody({ message }: { message: WhatsAppMessage }) {
  if (message.messageType === "text") {
    return <p className="whitespace-pre-wrap">{message.body}</p>;
  }

  const caption = message.body?.trim();
  return (
    <div className="flex flex-col gap-1">
      <MediaElement message={message} />
      {caption && <p className="whitespace-pre-wrap">{caption}</p>}
    </div>
  );
}

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
  contactName,
  messages,
}: {
  contactId: ID;
  contactName: string;
  messages: WhatsAppMessage[];
}) {
  const router = useRouter();
  const { setReplyingTo } = useReply();
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => groupMessages(messages), [messages]);

  /** Rótulo do autor de um trecho citado: "Você" para o corretor, nome do contato para o cliente. */
  const authorLabel = (direction: WhatsAppMessage["direction"]) =>
    direction === "outbound" ? "Você" : contactName;

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
                        "group flex max-w-[85%] items-center gap-1",
                        isOutbound ? "flex-row" : "flex-row-reverse",
                      )}
                    >
                      <button
                        type="button"
                        aria-label="Responder a esta mensagem"
                        onClick={() =>
                          setReplyingTo({
                            id: message.id,
                            body: messagePreview(message.messageType, message.body),
                            direction: message.direction,
                          })
                        }
                        // No celular o botão fica sempre visível e encostado na
                        // bolha: 24px era alvo de errar. No desktop ele só
                        // aparece no hover, e o ponteiro acerta 24px sem drama.
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint opacity-60 transition-opacity hover:bg-veil/6 hover:text-foreground focus-visible:opacity-100 md:h-6 md:w-6 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Reply className="h-4 w-4" />
                      </button>
                      <div
                        className={cn(
                          "min-w-0 rounded-[14px] border px-3 py-2 text-sm",
                          isOutbound
                            ? "rounded-br-[4px] border-bubble-out-line bg-bubble-out text-bubble-out-fg"
                            : "rounded-bl-[4px] border-veil/5 bg-bubble-in text-bubble-in-fg",
                        )}
                      >
                        {message.replyTo && (
                          <div className="mb-1 border-l-2 border-jade/60 bg-veil/6 px-2 py-1 text-xs">
                            <p className="font-medium text-jade">{authorLabel(message.replyTo.direction)}</p>
                            <p className="truncate text-ink-faint">{message.replyTo.body}</p>
                          </div>
                        )}
                        <MessageBody message={message} />
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
