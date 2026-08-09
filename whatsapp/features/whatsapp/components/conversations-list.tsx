"use client";

import Link, { useLinkStatus } from "next/link";
import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pin, Star } from "lucide-react";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { cn, formatDate } from "@/lib/utils";
import type { WhatsAppConversationSummary, WhatsAppMessageSearchResult } from "@/types/whatsapp";

/** Carimbo de hora no padrão da lista do WhatsApp: hora para hoje, "Ontem",
 * dia da semana dentro dos últimos 7 dias e data curta para o resto. */
export function conversationTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  if (differenceInCalendarDays(new Date(), date) < 7) {
    return format(date, "EEEE", { locale: ptBR });
  }
  return formatDate(date);
}

function buildHref(contactId: string, query?: string): string {
  const params = new URLSearchParams({ c: contactId });
  if (query) params.set("q", query);
  return `/?${params.toString()}`;
}

/** Linha de conversa no layout do WhatsApp: avatar à esquerda; nome + hora na
 * primeira linha; prévia + badge de não lidas na segunda. O menu de contexto
 * (segurar pressionado / botão direito) fica no wrapper — ver
 * ConversationContextMenu. select-none e touch-callout evitam a seleção de
 * texto do navegador durante o long-press. */
export function ConversationRow({
  conversation,
  isSelected,
  query,
}: {
  conversation: WhatsAppConversationSummary;
  isSelected: boolean;
  query?: string;
}) {
  return (
    <Link
      href={buildHref(conversation.contactId, query)}
      scroll={false}
      draggable={false}
      className="block select-none [-webkit-touch-callout:none]"
    >
      <ConversationRowBody conversation={conversation} isSelected={isSelected} />
    </Link>
  );
}

/** Filho do <Link> para ler o useLinkStatus: a seleção muda de linha no clique
 * em vez de esperar o servidor devolver a conversa (a linha ativa vem do
 * ?c= na URL, que só troca no fim da navegação). */
function ConversationRowBody({
  conversation,
  isSelected,
}: {
  conversation: WhatsAppConversationSummary;
  isSelected: boolean;
}) {
  const { pending } = useLinkStatus();
  const hasUnread = conversation.unreadCount > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 active:bg-veil/12 active:duration-0",
        (isSelected || pending) && "bg-veil/7 hover:bg-veil/7",
        !isSelected && !pending && "hover:bg-veil/4",
      )}
    >
      <AvatarInitials name={conversation.contactName} size="lg" className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-[15px]", hasUnread ? "font-semibold" : "font-medium")}>
            {conversation.contactName}
          </p>
          {conversation.lastMessageAt && (
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                hasUnread ? "font-medium text-jade" : "text-muted-foreground",
              )}
            >
              {conversationTimeLabel(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm",
              hasUnread ? "text-foreground/80" : "text-muted-foreground",
            )}
          >
            {conversation.lastMessagePreview ? (
              <>
                {conversation.lastMessageDirection === "outbound" && (
                  <span className="text-muted-foreground">Você: </span>
                )}
                {conversation.lastMessagePreview}
              </>
            ) : (
              <span className="italic text-muted-foreground/70">Sem mensagens</span>
            )}
          </p>
          <span className="flex shrink-0 items-center gap-1.5">
            {conversation.contactIsFavorite && (
              <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            )}
            {conversation.pinnedAt && !hasUnread && (
              <Pin className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {hasUnread && (
              <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#3a7d5c] px-1.5 text-[11px] font-semibold text-white">
                {conversation.unreadCount}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Resultado de busca dentro das mensagens (seção "Mensagens"), no formato do
 * WhatsApp: contato + data na primeira linha, trecho encontrado na segunda. */
export function MessageResultRow({
  result,
  query,
}: {
  result: WhatsAppMessageSearchResult;
  query: string;
}) {
  return (
    <Link
      href={buildHref(result.contactId, query)}
      scroll={false}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-veil/4 active:bg-veil/12 active:duration-0"
    >
      <AvatarInitials name={result.contactName} size="lg" className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-medium">{result.contactName}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {conversationTimeLabel(result.waTimestamp)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {result.direction === "outbound" && "Você: "}
          {result.body}
        </p>
      </div>
    </Link>
  );
}
