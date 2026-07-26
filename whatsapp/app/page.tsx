import { FlaskConical, MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { BlockedContactNotice } from "@/features/whatsapp/components/blocked-contact-notice";
import { ChatListPanel } from "@/features/whatsapp/components/chat-list-panel";
import { ConversationThread } from "@/features/whatsapp/components/conversation-thread";
import { ConversationThreadHeader } from "@/features/whatsapp/components/conversation-thread-header";
import { MessageComposer } from "@/features/whatsapp/components/message-composer";
import { ReplyProvider } from "@/features/whatsapp/reply-context";
import { SimulateMessageForm } from "@/features/whatsapp/components/simulate-message-form";
import { isMockWhatsAppProvider } from "@/services/whatsapp";
import {
  getConversations,
  getConversationMessages,
  searchMessages,
} from "@/services/whatsapp.service";
import { getContactById } from "@/services/contacts.service";
import { getTags } from "@/services/tags.service";
import { getTemplates } from "@/services/templates.service";

interface HomePageProps {
  searchParams: Promise<{ c?: string; q?: string }>;
}

/** Inbox de duas colunas (CV-1): lista fixa + thread na mesma tela, sem
 * navegar para a ficha do contato a cada conversa aberta (padrão WhatsApp
 * Web/Front/Intercom). No mobile, mantém a navegação em 2 telas.
 * A busca (?q=) roda no servidor e alimenta a seção "Mensagens" do painel. */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { c: selectedContactId, q: query } = await searchParams;

  const [conversations, messageResults, tags] = await Promise.all([
    getConversations(),
    query?.trim() ? searchMessages(query) : Promise.resolve([]),
    getTags(),
  ]);

  const selected = selectedContactId
    ? await Promise.all([
        getContactById(selectedContactId),
        getConversationMessages(selectedContactId),
        getTemplates(),
      ])
    : null;
  const [selectedContact, selectedMessages, templates] = selected ?? [null, [], []];

  return (
    <div className="flex flex-col gap-4 md:h-[calc(100vh-3rem)]">
      {isMockWhatsAppProvider && !selectedContactId && (
        <details className="rounded-lg border border-dashed p-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <FlaskConical className="h-4 w-4" />
            Simular mensagem recebida (modo mock)
          </summary>
          <div className="mt-3">
            <SimulateMessageForm />
          </div>
        </details>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border">
        {/* Painel de conversas: full-width no mobile quando nada selecionado;
            coluna fixa no desktop (título + busca + filtros + lista). */}
        <div
          className={cn(
            "w-full shrink-0 md:w-96 md:border-r",
            selectedContactId ? "hidden md:block" : "block",
          )}
        >
          <ChatListPanel
            conversations={conversations}
            messageResults={messageResults}
            tags={tags}
            query={query?.trim() ?? ""}
            selectedContactId={selectedContactId}
          />
        </div>

        {/* Thread: no mobile vira overlay em tela cheia (como o WhatsApp) —
            com altura definida, a rolagem fica interna à conversa e nada
            desliza por cima do header do app; no desktop, resto da tela.
            h-dvh (não inset-0/bottom-0) porque o Safari iOS recalcula mal a
            altura de position:fixed quando a barra de endereço esconde —
            dvh acompanha o viewport visível de verdade. */}
        <div
          className={cn(
            "min-w-0 flex-1 flex-col",
            selectedContactId
              ? "flex max-md:fixed max-md:inset-x-0 max-md:top-0 max-md:z-20 max-md:h-dvh max-md:overflow-hidden max-md:bg-background"
              : "hidden md:flex",
          )}
        >
          {selectedContact ? (
            <ReplyProvider key={selectedContact.id}>
              <div className="flex h-full min-h-0 flex-col animate-in fade-in duration-200">
                <ConversationThreadHeader contact={selectedContact} />
                <ConversationThread
                  contactId={selectedContact.id}
                  contactName={selectedContact.name}
                  messages={selectedMessages}
                />
                <div className="border-t bg-card p-3">
                  {selectedContact.isBlocked ? (
                    <BlockedContactNotice contactId={selectedContact.id} />
                  ) : (
                    <MessageComposer
                      contactId={selectedContact.id}
                      contactName={selectedContact.name}
                      templates={templates}
                    />
                  )}
                </div>
              </div>
            </ReplyProvider>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-well/50 p-6">
              <EmptyState
                icon={MessageCircle}
                title="Selecione uma conversa"
                description="Escolha um contato na lista à esquerda para ver as mensagens."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
