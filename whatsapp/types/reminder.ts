import type { ReminderStatus } from "@/constants/reminder-status";
import type { ID } from "./common";

export interface ContactReminder {
  id: ID;
  contactId: ID;
  title: string;
  description: string | null;
  reminderAt: string;
  status: ReminderStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Lembrete com dados do contato embutidos, usado na Central de Lembretes e no Dashboard. */
export interface ReminderWithContact extends ContactReminder {
  contactName: string;
  contactPhone: string;
}

export interface CreateReminderInput {
  contactId: ID;
  title: string;
  description?: string | null;
  reminderAt: string;
  createdBy: string;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string | null;
  reminderAt?: string;
  status?: ReminderStatus;
}

export interface ReminderFilters {
  date?: string;
  contactId?: ID;
  status?: ReminderStatus;
}
