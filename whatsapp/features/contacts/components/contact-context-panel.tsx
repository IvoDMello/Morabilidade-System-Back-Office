import Link from "next/link";
import { ArrowUpRight, BellRing, Building2 } from "lucide-react";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { CategoryBadge } from "./category-badge";
import { StatusBadge } from "./status-badge";
import { ReminderRelativeTime } from "@/features/reminders-hub/components/reminder-relative-time";
import { PROPERTY_STAGE_COLORS, PROPERTY_STAGE_LABELS } from "@/constants/property-stages";
import { cn, formatPhone } from "@/lib/utils";
import type { Contact } from "@/types/contact";
import type { ContactReminder } from "@/types/reminder";
import type { ContactPropertyWithDetails } from "@/types/property";

interface ContactContextPanelProps {
  contact: Contact;
  reminders: ContactReminder[];
  properties: ContactPropertyWithDetails[];
}

/**
 * Resumo read-only do registro (FM-3): ao lado do formulário de edição em
 * telas largas, para não perder de vista badges/lembretes/imóveis enquanto
 * edita — sem duplicar as ações interativas da ficha completa.
 */
export function ContactContextPanel({ contact, reminders, properties }: ContactContextPanelProps) {
  const pendingReminders = reminders.filter((r) => r.status === "pendente").slice(0, 3);

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-3">
          <AvatarInitials name={contact.name} size="md" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{contact.name}</p>
            <p className="truncate text-sm text-muted-foreground">{formatPhone(contact.phone)}</p>
          </div>
        </div>
        <Link
          href={`/contatos/${contact.id}`}
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Ficha completa
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <CategoryBadge category={contact.category} />
        <StatusBadge status={contact.status} />
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          <BellRing className="h-3.5 w-3.5" />
          Lembretes
        </p>
        {pendingReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lembrete pendente.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingReminders.map((reminder) => (
              <li key={reminder.id} className="text-sm">
                <p className="truncate">{reminder.title}</p>
                <ReminderRelativeTime
                  date={reminder.reminderAt}
                  isOverdue={new Date(reminder.reminderAt) < new Date()}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          <Building2 className="h-3.5 w-3.5" />
          Imóveis
        </p>
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel vinculado.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {properties.map((property) => (
              <li key={property.propertyId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{property.code}</span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    PROPERTY_STAGE_COLORS[property.stage],
                  )}
                >
                  {PROPERTY_STAGE_LABELS[property.stage]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
