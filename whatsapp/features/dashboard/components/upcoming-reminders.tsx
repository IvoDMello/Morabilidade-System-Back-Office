import Link from "next/link";
import { BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import type { ReminderWithContact } from "@/types/reminder";

export function UpcomingReminders({ reminders }: { reminders: ReminderWithContact[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos lembretes de hoje</CardTitle>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <EmptyState icon={BellRing} title="Nenhum lembrete para hoje" />
        ) : (
          <ul className="flex flex-col divide-y">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    href={`/contatos/${reminder.contactId}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {reminder.title}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {reminder.contactName}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(reminder.reminderAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
