"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Inbox, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { RemindersFilters } from "@/features/reminders-hub/components/reminders-filters";
import { RemindersGroup } from "@/features/reminders-hub/components/reminders-group";
import { NovoLembreteButton } from "@/features/reminders-hub/components/novo-lembrete-button";
import { PendingConversationCard } from "./pending-conversation-card";
import { FailedMessageCard } from "./failed-message-card";
import { AiRevisaoCard } from "./ai-revisao-card";
import { analisarComIaAction, type AnaliseIaResult } from "@/app/pendencias/actions";
import type { PendingConversationItem, PendingQueue } from "@/services/whatsapp.service";
import type { FailedOutboundMessage } from "@/types/whatsapp";
import type { ReminderGroups } from "@/features/reminders-hub/lib/partition-reminders";
import type { PendenciasTab } from "@/features/pendencias/lib/tabs";
import type { Contact } from "@/types/contact";

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

interface PendenciasViewProps {
  queue: PendingQueue;
  reminders: ReminderGroups;
  contacts: Contact[];
  /** Envios recusados pela Meta nos últimos 7 dias. */
  falhas: FailedOutboundMessage[];
  defaultTab: PendenciasTab;
}

/**
 * Tela única de "o que falta fazer": conversas aguardando resposta, lembretes e
 * follow-ups na mesma barra de abas. Eram duas seções separadas no menu que
 * respondiam à mesma pergunta, obrigando a checar dois lugares antes de saber
 * se o dia estava limpo.
 *
 * A aba vive só no estado local depois do primeiro render: trocar de aba não
 * pode custar uma ida ao servidor. O `defaultTab` vem da URL para que links
 * diretos (e o redirect de /lembretes) caiam na aba certa.
 */
export function PendenciasView({
  queue,
  reminders,
  contacts,
  falhas,
  defaultTab,
}: PendenciasViewProps) {
  // Deep-link para uma aba que sumiu (sem falhas hoje) cairia numa tela vazia
  // sem nenhuma aba marcada — melhor voltar para a fila principal.
  const [tab, setTab] = useState<PendenciasTab>(
    defaultTab === "falhas" && falhas.length === 0 ? "aguardando" : defaultTab,
  );
  const [analise, setAnalise] = useState<AnaliseIaResult | null>(null);
  const [isAnalisando, startAnalise] = useTransition();

  function analisar() {
    startAnalise(async () => {
      const res = await analisarComIaAction();
      setAnalise(res);
      if (!res.ok) {
        toast.error(res.erro ?? "Não foi possível revisar.");
        return;
      }
      const n = Object.keys(res.encerramentos).length;
      toast.success(
        n === 0
          ? "Revisão concluída."
          : `Revisão concluída — ${n} conversa(s) provavelmente já resolvidas.`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <AiRevisaoCard result={analise} isPending={isAnalisando} onAnalisar={analisar} />

      <Tabs value={tab} onValueChange={(value) => setTab(value as PendenciasTab)}>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
          <TabsList variant="line" className="w-max">
            <TabsTrigger value="aguardando" className="shrink-0">
              Aguardando ({queue.aguardandoResposta.length})
            </TabsTrigger>
            {/* Só aparece quando há falha. Uma aba permanentemente zerada
                ensina a ignorá-la, e aí ela não serve pra nada no dia em que
                encher. */}
            {falhas.length > 0 && (
              <TabsTrigger value="falhas" className="shrink-0 text-ember">
                Não entregues ({falhas.length})
              </TabsTrigger>
            )}
            <TabsTrigger value="lembretes" className="shrink-0">
              Lembretes ({reminders.overdue.length + reminders.today.length})
            </TabsTrigger>
            <TabsTrigger value="followup" className="shrink-0">
              Follow-ups ({queue.followUpSugerido.length})
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
            suggestions={analise?.encerramentos}
          />
        </TabsContent>

        <TabsContent value="falhas" className="mt-3">
          {falhas.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nenhum envio recusado nos últimos 7 dias" />
          ) : (
            <ul className="flex flex-col gap-3">
              {falhas.map((falha) => (
                <FailedMessageCard key={falha.id} item={falha} />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="lembretes" className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <RemindersFilters contacts={contacts} />
            <div className="sm:ml-auto sm:shrink-0">
              <NovoLembreteButton contacts={contacts} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RemindersGroup
              title="Vencidos"
              variant="overdue"
              reminders={reminders.overdue}
              emptyLabel="Nenhum lembrete vencido"
            />
            <RemindersGroup
              title="Hoje"
              variant="today"
              reminders={reminders.today}
              emptyLabel="Nenhum lembrete para hoje"
            />
            <RemindersGroup
              title="Próximos"
              variant="upcoming"
              reminders={reminders.upcoming}
              emptyLabel="Nenhum lembrete futuro"
            />
          </div>
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
    </div>
  );
}
