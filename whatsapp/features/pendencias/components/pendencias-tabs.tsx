"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Inbox, MessagesSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PendingConversationCard } from "./pending-conversation-card";
import { revisarEncerramentosAction } from "@/app/pendencias/actions";
import type { PendingConversationItem, PendingQueue } from "@/services/whatsapp.service";

function PendingList({
  items,
  emptyIcon: EmptyIcon,
  emptyTitle,
  showSnooze,
  suggestions,
}: {
  items: PendingConversationItem[];
  emptyIcon: typeof CheckCircle2;
  emptyTitle: string;
  showSnooze?: boolean;
  suggestions?: Record<string, string>;
}) {
  if (items.length === 0) {
    return <EmptyState icon={EmptyIcon} title={emptyTitle} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <PendingConversationCard
          key={item.id}
          item={item}
          showSnooze={showSnooze}
          suggestion={suggestions?.[item.id]}
        />
      ))}
    </ul>
  );
}

export function PendenciasTabs({ queue }: { queue: PendingQueue }) {
  const [encerramentos, setEncerramentos] = useState<Record<string, string>>({});
  const [revisado, setRevisado] = useState(false);
  const [isRevising, startRevising] = useTransition();

  function revisar() {
    startRevising(async () => {
      const res = await revisarEncerramentosAction();
      if (!res.ok) {
        toast.error(res.erro ?? "Não foi possível revisar.");
        return;
      }
      setEncerramentos(res.encerramentos);
      setRevisado(true);
      const n = Object.keys(res.encerramentos).length;
      toast.success(
        n === 0
          ? "Nenhum encerramento — todas parecem precisar de resposta."
          : `${n} conversa(s) provavelmente não precisam de resposta.`,
      );
    });
  }

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
        {queue.aguardandoResposta.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-dashed bg-veil/3 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Alguns "aguardando" podem ser só agradecimento ou "eu te retorno". A IA aponta quais.
            </p>
            <Button size="sm" variant="outline" onClick={revisar} loading={isRevising} className="shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
              {revisado ? "Revisar de novo" : "Revisar com IA"}
            </Button>
          </div>
        )}
        <PendingList
          items={queue.aguardandoResposta}
          emptyIcon={CheckCircle2}
          emptyTitle="Nenhuma conversa aguardando resposta"
          suggestions={encerramentos}
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
