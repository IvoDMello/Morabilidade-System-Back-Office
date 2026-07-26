"use client";

import { CheckCircle2, Inbox, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PendingConversationCard } from "./pending-conversation-card";
import type { PendingConversationItem, PendingQueue } from "@/services/whatsapp.service";

function PendingList({
  items,
  emptyIcon: EmptyIcon,
  emptyTitle,
  showSnooze,
}: {
  items: PendingConversationItem[];
  emptyIcon: typeof CheckCircle2;
  emptyTitle: string;
  showSnooze?: boolean;
}) {
  if (items.length === 0) {
    return <EmptyState icon={EmptyIcon} title={emptyTitle} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <PendingConversationCard key={item.id} item={item} showSnooze={showSnooze} />
      ))}
    </ul>
  );
}

export function PendenciasTabs({ queue }: { queue: PendingQueue }) {
  return (
    <Tabs defaultValue="aguardando">
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        <TabsList variant="line" className="w-max">
          <TabsTrigger value="aguardando" className="shrink-0">
            Aguardando resposta ({queue.aguardandoResposta.length})
          </TabsTrigger>
          <TabsTrigger value="followup" className="shrink-0">
            Follow-ups sugeridos ({queue.followUpSugerido.length})
          </TabsTrigger>
          <TabsTrigger value="todas" className="shrink-0">
            Todas as ativas ({queue.todasAtivas.length})
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="aguardando" className="mt-3">
        <PendingList
          items={queue.aguardandoResposta}
          emptyIcon={CheckCircle2}
          emptyTitle="Nenhuma conversa aguardando resposta"
        />
      </TabsContent>

      <TabsContent value="followup" className="mt-3">
        <PendingList
          items={queue.followUpSugerido}
          emptyIcon={MessagesSquare}
          emptyTitle="Nenhum follow-up sugerido"
          showSnooze
        />
      </TabsContent>

      <TabsContent value="todas" className="mt-3">
        <PendingList
          items={queue.todasAtivas}
          emptyIcon={Inbox}
          emptyTitle="Nenhuma conversa ativa"
        />
      </TabsContent>
    </Tabs>
  );
}
