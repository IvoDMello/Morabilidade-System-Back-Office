"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { MessageReply } from "@/types/whatsapp";

interface ReplyContextValue {
  replyingTo: MessageReply | null;
  setReplyingTo: (reply: MessageReply | null) => void;
  clearReply: () => void;
}

const ReplyContext = createContext<ReplyContextValue | null>(null);

/**
 * Estado de "respondendo a uma mensagem" compartilhado entre o thread (onde se
 * escolhe a mensagem citada) e o composer (onde a citação aparece e é enviada).
 * Envolve os dois na página da conversa; a key por conversa reseta ao trocar.
 */
export function ReplyProvider({ children }: { children: ReactNode }) {
  const [replyingTo, setReplyingTo] = useState<MessageReply | null>(null);
  return (
    <ReplyContext.Provider
      value={{ replyingTo, setReplyingTo, clearReply: () => setReplyingTo(null) }}
    >
      {children}
    </ReplyContext.Provider>
  );
}

// Fallback estável para quando o composer é usado fora de um ReplyProvider
// (ex.: na timeline do contato, sem thread): responder fica simplesmente inerte.
const NOOP_REPLY: ReplyContextValue = {
  replyingTo: null,
  setReplyingTo: () => {},
  clearReply: () => {},
};

export function useReply(): ReplyContextValue {
  return useContext(ReplyContext) ?? NOOP_REPLY;
}
