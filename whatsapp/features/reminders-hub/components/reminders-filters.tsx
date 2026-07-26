"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REMINDER_STATUSES, REMINDER_STATUS_LABELS } from "@/constants/reminder-status";
import type { Contact } from "@/types/contact";

const ALL = "all";

export function RemindersFilters({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateOpen, setDateOpen] = useState(false);

  const dateParam = searchParams.get("date");
  const selectedDate = dateParam ? new Date(`${dateParam}T00:00:00`) : undefined;

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/lembretes?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-1.5">
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="w-full justify-start gap-2 font-normal sm:w-52"
              />
            }
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            {selectedDate ? (
              <span className="tabular-nums">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            ) : (
              <span className="text-muted-foreground">Filtrar por data</span>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-1">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={selectedDate}
              onSelect={(date) => {
                setDateOpen(false);
                updateParam("date", date ? format(date, "yyyy-MM-dd") : null);
              }}
            />
          </PopoverContent>
        </Popover>
        {selectedDate && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Limpar filtro de data"
            onClick={() => updateParam("date", null)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Select
        value={searchParams.get("contactId") ?? ALL}
        onValueChange={(value) => updateParam("contactId", value)}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="Contato">
            {(value: string) =>
              value === ALL
                ? "Todos os contatos"
                : (contacts.find((c) => c.id === value)?.name ?? "Contato")
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os contatos</SelectItem>
          {contacts.map((contact) => (
            <SelectItem key={contact.id} value={contact.id}>
              {contact.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") ?? ALL}
        onValueChange={(value) => updateParam("status", value)}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Status">
            {(value: string) =>
              value === ALL
                ? "Todos os status"
                : REMINDER_STATUS_LABELS[value as keyof typeof REMINDER_STATUS_LABELS]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os status</SelectItem>
          {REMINDER_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
