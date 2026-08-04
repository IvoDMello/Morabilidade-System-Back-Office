import type { ID } from "@/types/common";
import type {
  ContactReminder,
  CreateReminderInput,
  ReminderFilters,
  ReminderWithContact,
  UpdateReminderInput,
} from "@/types/reminder";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function withContact(reminder: ContactReminder): ReminderWithContact {
  const contact = mockStore.contacts.find((c) => c.id === reminder.contactId);
  return {
    ...reminder,
    contactName: contact?.name ?? "Contato removido",
    contactPhone: contact?.phone ?? "",
  };
}

export const mockReminders: DataSource["reminders"] = {
  async listByContact(contactId: ID) {
    return mockStore.reminders
      .filter((r) => r.contactId === contactId)
      .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime());
  },

  async listAll(filters: ReminderFilters = {}) {
    let results = mockStore.reminders.map(withContact);

    if (filters.contactId) {
      results = results.filter((r) => r.contactId === filters.contactId);
    }
    if (filters.status) {
      results = results.filter((r) => r.status === filters.status);
    }
    if (filters.date) {
      const target = new Date(filters.date);
      results = results.filter((r) => isSameDay(new Date(r.reminderAt), target));
    }

    return results.sort(
      (a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime(),
    );
  },

  async getById(id: ID) {
    return mockStore.reminders.find((r) => r.id === id) ?? null;
  },

  async create(input: CreateReminderInput) {
    const nowIso = new Date().toISOString();
    const newReminder: ContactReminder = {
      id: generateId(),
      contactId: input.contactId,
      title: input.title,
      description: input.description ?? null,
      reminderAt: input.reminderAt,
      status: "pendente",
      createdBy: input.createdBy,
      corretorId: input.corretorId ?? null,
      imovelCodigo: input.imovelCodigo ?? null,
      fichaVisitaId: null,
      fichaNotificadaEm: null,
      googleCalendarEventId: input.googleCalendarEventId ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    mockStore.reminders.push(newReminder);
    return newReminder;
  },

  async update(id: ID, input: UpdateReminderInput) {
    const index = mockStore.reminders.findIndex((r) => r.id === id);
    if (index === -1) throw new Error("Lembrete não encontrado");

    const updated: ContactReminder = {
      ...mockStore.reminders[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    mockStore.reminders[index] = updated;
    return updated;
  },

  async remove(id: ID) {
    mockStore.reminders = mockStore.reminders.filter((r) => r.id !== id);
  },

  async listVisitasParaFicha(fromIso: string, toIso: string) {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    return mockStore.reminders
      .filter((r) => {
        const at = new Date(r.reminderAt).getTime();
        return r.status === "pendente" && !r.fichaNotificadaEm && at >= from && at <= to;
      })
      .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime())
      .map((r) => {
        const contact = mockStore.contacts.find((c) => c.id === r.contactId);
        const corretor = mockStore.corretores.find((c) => c.id === r.corretorId);
        return {
          reminderId: r.id,
          reminderAt: r.reminderAt,
          contactId: r.contactId,
          contactName: contact?.name ?? "",
          contactPhone: contact?.phone ?? "",
          clienteId: contact?.clienteId ?? null,
          imovelCodigo: r.imovelCodigo,
          title: r.title,
          fichaVisitaId: r.fichaVisitaId,
          corretorAuthUserId: corretor?.authUserId ?? null,
        };
      });
  },
};
