import { RemindersFilters } from "@/features/reminders-hub/components/reminders-filters";
import { RemindersGroup } from "@/features/reminders-hub/components/reminders-group";
import { NovoLembreteButton } from "@/features/reminders-hub/components/novo-lembrete-button";
import { partitionReminders } from "@/features/reminders-hub/lib/partition-reminders";
import { getContacts } from "@/services/contacts.service";
import { getAllReminders } from "@/services/reminders.service";
import type { ReminderStatus } from "@/constants/reminder-status";

interface LembretesPageProps {
  searchParams: Promise<{
    date?: string;
    contactId?: string;
    status?: string;
  }>;
}

export default async function LembretesPage({ searchParams }: LembretesPageProps) {
  const params = await searchParams;

  const [reminders, contacts] = await Promise.all([
    getAllReminders({
      date: params.date,
      contactId: params.contactId,
      status: params.status as ReminderStatus | undefined,
    }),
    getContacts({ sortBy: "name" }),
  ]);

  const { overdue, today, upcoming } = partitionReminders(reminders);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3.5">
        <div className="hidden items-center gap-3.5 md:flex">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Lembretes</h1>
          {overdue.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg border border-[rgba(196,85,62,0.28)] bg-[rgba(196,85,62,0.12)] px-2.5 py-1 text-[12.5px] font-semibold text-ember">
              {overdue.length} atrasado{overdue.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="ml-auto">
          <NovoLembreteButton contacts={contacts} />
        </div>
      </div>

      <RemindersFilters contacts={contacts} />

      <div className="grid gap-6 lg:grid-cols-3">
        <RemindersGroup
          title="Vencidos"
          variant="overdue"
          reminders={overdue}
          emptyLabel="Nenhum lembrete vencido"
        />
        <RemindersGroup
          title="Hoje"
          variant="today"
          reminders={today}
          emptyLabel="Nenhum lembrete para hoje"
        />
        <RemindersGroup
          title="Próximos"
          variant="upcoming"
          reminders={upcoming}
          emptyLabel="Nenhum lembrete futuro"
        />
      </div>
    </div>
  );
}
