import { PendenciasView } from "@/features/pendencias/components/pendencias-view";
import { PlacarAgente } from "@/features/pendencias/components/placar-agente";
import { FalhasEntregaAlerta } from "@/features/pendencias/components/falhas-entrega-alerta";
import { isPendenciasTab, PENDENCIAS_TAB_PADRAO } from "@/features/pendencias/lib/tabs";
import { partitionReminders } from "@/features/reminders-hub/lib/partition-reminders";
import { getFailedOutbound, getPendingQueue } from "@/services/whatsapp.service";
import { getFalhasDeEntrega } from "@/services/webhook-log.service";
import { getPlacar } from "@/services/agent-proposals.service";
import { getAllReminders } from "@/services/reminders.service";
import { getContacts } from "@/services/contacts.service";
import type { ReminderStatus } from "@/constants/reminder-status";

interface PendenciasPageProps {
  searchParams: Promise<{
    tab?: string;
    date?: string;
    contactId?: string;
    status?: string;
  }>;
}

/** Central de pendências: conversas aguardando, lembretes e follow-ups na
 * mesma tela. Os filtros de lembrete continuam na URL (link compartilhável e
 * botão voltar funcionando); a aba ativa também, para deep-link. */
export default async function PendenciasPage({ searchParams }: PendenciasPageProps) {
  const params = await searchParams;

  // Placar é best-effort: sem a migration 0020 aplicada, a página segue inteira.
  const [queue, placar, reminders, contacts, falhas, falhasEntrega] = await Promise.all([
    getPendingQueue(),
    getPlacar().catch(() => null),
    getAllReminders({
      date: params.date,
      contactId: params.contactId,
      status: params.status as ReminderStatus | undefined,
    }),
    getContacts({ sortBy: "name" }),
    getFailedOutbound(),
    getFalhasDeEntrega(),
  ]);

  const grupos = partitionReminders(reminders);
  const aguardando = queue.aguardandoResposta.length;
  const vencidos = grupos.overdue.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Pendências</h1>
        {aguardando > 0 && (
          <span className="flex items-center gap-1.5 rounded-lg border border-[rgba(239,122,122,0.28)] bg-[rgba(239,122,122,0.12)] px-2.5 py-1 text-[12.5px] font-semibold text-ember">
            {aguardando} aguardando resposta
          </span>
        )}
        {vencidos > 0 && (
          <span className="flex items-center gap-1.5 rounded-lg border border-[rgba(239,122,122,0.28)] bg-[rgba(239,122,122,0.12)] px-2.5 py-1 text-[12.5px] font-semibold text-ember">
            {vencidos} lembrete{vencidos === 1 ? "" : "s"} vencido{vencidos === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Antes de tudo: se mensagem está sendo recusada no webhook, nenhuma
          das filas abaixo está completa. */}
      <FalhasEntregaAlerta falhas={falhasEntrega} />

      {placar && <PlacarAgente placar={placar} />}

      <PendenciasView
        queue={queue}
        reminders={grupos}
        contacts={contacts}
        falhas={falhas}
        defaultTab={isPendenciasTab(params.tab) ? params.tab : PENDENCIAS_TAB_PADRAO}
      />
    </div>
  );
}
