import type { ContactCategory } from "@/constants/contact-categories";
import type { ContactStatus } from "@/constants/contact-status";
import type { Contact } from "./contact";
import type { ReminderWithContact } from "./reminder";

/** Variação percentual numa janela de 7 dias (DB-3) — null quando não há base de comparação. */
export type WeeklyDelta = number | null;

export interface DashboardStats {
  totalContacts: number;
  totalContactsDelta: WeeklyDelta;
  contactsByCategory: Record<ContactCategory, number>;
  contactsByStatus: Record<ContactStatus, number>;
  pendingReminders: number;
  pendingRemindersDelta: WeeklyDelta;
  overdueReminders: number;
  overdueRemindersDelta: WeeklyDelta;
  todayReminders: ReminderWithContact[];
  todayRemindersDelta: WeeklyDelta;
  recentContacts: Contact[];
}

export interface ReminderCounts {
  pending: number;
  overdue: number;
}
