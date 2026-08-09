import { dataSource } from "./data";
import type { ID } from "@/types/common";
import type {
  CreateReminderInput,
  ReminderFilters,
  UpdateReminderInput,
} from "@/types/reminder";

export function getRemindersByContact(contactId: ID) {
  return dataSource.reminders.listByContact(contactId);
}

export function getAllReminders(filters?: ReminderFilters) {
  return dataSource.reminders.listAll(filters);
}

export function getReminderById(id: ID) {
  return dataSource.reminders.getById(id);
}

export function createReminder(input: CreateReminderInput) {
  return dataSource.reminders.create(input);
}

export function updateReminder(id: ID, input: UpdateReminderInput) {
  return dataSource.reminders.update(id, input);
}

export function completeReminder(id: ID) {
  return dataSource.reminders.update(id, { status: "concluido" });
}

export function cancelReminder(id: ID) {
  return dataSource.reminders.update(id, { status: "cancelado" });
}

export function deleteReminder(id: ID) {
  return dataSource.reminders.remove(id);
}
