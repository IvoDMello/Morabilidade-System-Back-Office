"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Search, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { ChatListMenu } from "./chat-list-menu";
import { ConversationContextMenu } from "./conversation-context-menu";
import { ConversationRow, MessageResultRow } from "./conversations-list";
import type { Tag } from "@/types/tag";
import type { Corretor } from "@/types/corretor";
import type { WhatsAppConversationSummary, WhatsAppMessageSearchResult } from "@/types/whatsapp";

const SEARCH_DEBOUNCE_MS = 300;

type ChatFilter = "all" | "unread" | "favorites";

const FILTERS: { value: ChatFilter; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "unread", label: "Não lidas" },
  { value: "favorites", label: "Favoritas" },
];

function normalizeForSearch(text: string): string {
  // Remove diacríticos (NFD separa a letra do acento) para busca sem acento.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesQuery(conversation: WhatsAppConversationSummary, query: string): boolean {
  if (normalizeForSearch(conversation.contactName).includes(normalizeForSearch(query))) {
    return true;
  }
  const queryDigits = query.replace(/\D/g, "");
  return queryDigits.length > 0 && conversation.contactPhone.replace(/\D/g, "").includes(queryDigits);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-4 text-sm font-medium text-jade first:pt-2">{children}</p>
  );
}

/** Coluna de conversas no padrão do WhatsApp Business: título, campo de busca
 * em pílula, chips de filtro e a lista. Com texto na busca, mostra as seções
 * "Conversas" (nome/telefone) e "Mensagens" (trechos vindos do servidor).
 * Segurar uma conversa pressionada (ou botão direito) abre direto o menu de
 * ações (não lida, favoritos, etiqueta, limpar, bloquear). */
export function ChatListPanel({
  conversations,
  messageResults,
  tags,
  corretores,
  query,
  selectedContactId,
}: {
  conversations: WhatsAppConversationSummary[];
  messageResults: WhatsAppMessageSearchResult[];
  tags: Tag[];
  corretores: Corretor[];
  query: string;
  selectedContactId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState(query);
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [activeCorretorId, setActiveCorretorId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sincroniza o texto digitado com ?q= (com debounce) — a busca nas mensagens
  // roda no servidor, então a URL é a fonte de verdade da consulta.
  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = input.trim();
      if (trimmed === query) return;
      const params = new URLSearchParams();
      if (selectedContactId) params.set("c", selectedContactId);
      if (trimmed) params.set("q", trimmed);
      const target = params.size > 0 ? `/?${params.toString()}` : "/";
      startTransition(() => router.replace(target, { scroll: false }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const isSearching = input.trim().length > 0;

  const activeTag = useMemo(
    () => (activeTagId ? (tags.find((t) => t.id === activeTagId) ?? null) : null),
    [tags, activeTagId],
  );

  const activeCorretor = useMemo(
    () => (activeCorretorId ? (corretores.find((c) => c.id === activeCorretorId) ?? null) : null),
    [corretores, activeCorretorId],
  );

  const filteredByChip = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    if (filter === "favorites") list = list.filter((c) => c.contactIsFavorite);
    if (activeTagId) list = list.filter((c) => c.contactTagIds.includes(activeTagId));
    if (activeCorretorId) list = list.filter((c) => c.contactCorretorId === activeCorretorId);
    return list;
  }, [conversations, filter, activeTagId, activeCorretorId]);

  const nameMatches = useMemo(
    () => (isSearching ? filteredByChip.filter((c) => matchesQuery(c, input)) : filteredByChip),
    [filteredByChip, input, isSearching],
  );

  // Só mostra resultados de mensagem já consistentes com o que está digitado —
  // evita piscar resultados velhos enquanto o servidor responde o debounce.
  const showMessageResults = isSearching && input.trim() === query;

  function renderRow(conversation: WhatsAppConversationSummary, rowQuery?: string) {
    return (
      <li key={conversation.id}>
        <ConversationContextMenu conversation={conversation} allTags={tags}>
          <ConversationRow
            conversation={conversation}
            isSelected={conversation.contactId === selectedContactId}
            query={rowQuery}
          />
        </ConversationContextMenu>
      </li>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* No mobile o MobileHeader do shell já traz o título da tela. */}
      <div className="hidden shrink-0 items-center justify-between px-4 pb-2 pt-3 md:flex">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Conversas</h1>
        <ChatListMenu
          tags={tags}
          activeTagId={activeTagId}
          onSelectTag={setActiveTagId}
          corretores={corretores}
          activeCorretorId={activeCorretorId}
          onSelectCorretor={setActiveCorretorId}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 px-3 pb-2 pt-3 md:pt-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-veil/5 px-3 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pesquisar ou começar uma nova conversa"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Pesquisar conversas e mensagens"
          />
          {input.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setInput("");
                inputRef.current?.focus();
              }}
              aria-label="Limpar busca"
              className="-m-2 flex shrink-0 items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="md:hidden">
          <ChatListMenu
            tags={tags}
            activeTagId={activeTagId}
            onSelectTag={setActiveTagId}
            corretores={corretores}
            activeCorretorId={activeCorretorId}
            onSelectCorretor={setActiveCorretorId}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 pb-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] transition-colors",
              filter === value
                ? "border-transparent bg-primary/12 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-veil/4",
            )}
          >
            {label}
          </button>
        ))}
        {activeTag && (
          <button
            type="button"
            onClick={() => setActiveTagId(null)}
            title="Remover filtro de lista"
            className="flex items-center gap-1 rounded-full border border-transparent bg-primary/12 px-3 py-1 text-[13px] font-medium text-primary"
          >
            {activeTag.name}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {activeCorretor && (
          <button
            type="button"
            onClick={() => setActiveCorretorId(null)}
            title="Remover filtro de corretor"
            className="flex items-center gap-1 rounded-full border border-transparent bg-primary/12 px-3 py-1 text-[13px] font-medium text-primary"
          >
            {activeCorretor.nome}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isSearching ? (
          <>
            {nameMatches.length > 0 && (
              <>
                <SectionLabel>Conversas</SectionLabel>
                <ul className="flex flex-col">
                  {nameMatches.map((conversation) => renderRow(conversation, input.trim()))}
                </ul>
              </>
            )}
            {showMessageResults && messageResults.length > 0 && (
              <>
                <SectionLabel>Mensagens</SectionLabel>
                <ul className="flex flex-col">
                  {messageResults.map((result) => (
                    <li key={result.messageId}>
                      <MessageResultRow result={result} query={input.trim()} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            {nameMatches.length === 0 && (!showMessageResults || messageResults.length === 0) && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {showMessageResults
                  ? `Sem resultados para “${input.trim()}”`
                  : "Buscando…"}
              </p>
            )}
          </>
        ) : filteredByChip.length > 0 ? (
          <ul className="flex flex-col">
            {filteredByChip.map((conversation) => renderRow(conversation))}
          </ul>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={MessageCircle}
              title={filter === "all" && !activeTag ? "Nenhuma conversa ainda" : "Nada por aqui"}
              description={
                activeTag
                  ? `Nenhuma conversa na lista "${activeTag.name}".`
                  : filter === "all"
                    ? "Quando um contato escrever no WhatsApp, a conversa aparece aqui."
                    : filter === "unread"
                      ? "Nenhuma conversa não lida no momento."
                      : "Nenhuma conversa de contato favorito."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
