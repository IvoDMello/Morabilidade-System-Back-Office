import { isSameDay } from "date-fns";
import { CONTACT_CATEGORIES, type ContactCategory } from "@/constants/contact-categories";
import { CONTACT_STATUSES, type ContactStatus } from "@/constants/contact-status";
import type { DashboardStats, ReminderCounts, WeeklyDelta } from "@/types/dashboard";
import type { Contact } from "@/types/contact";
import type { ReminderWithContact } from "@/types/reminder";
import { getContacts } from "./contacts.service";
import { getAllReminders } from "./reminders.service";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** % de variação entre dois totais — null sem base de comparação (evita "+Infinity%"). */
function weeklyDelta(current: number, past: number): WeeklyDelta {
  if (past === 0) return current === 0 ? null : 100;
  return Math.round(((current - past) / past) * 100);
}

function emptyCategoryCounts(): Record<ContactCategory, number> {
  return Object.fromEntries(CONTACT_CATEGORIES.map((c) => [c.value, 0])) as Record<
    ContactCategory,
    number
  >;
}

function emptyStatusCounts(): Record<ContactStatus, number> {
  return Object.fromEntries(CONTACT_STATUSES.map((s) => [s.value, 0])) as Record<
    ContactStatus,
    number
  >;
}

/**
 * Reconstrói os 4 números dos stat cards como estariam num instante passado
 * (`at`), usando `createdAt` para saber o que já existia naquele momento.
 * Aproximação razoável para um dado mockado: não temos histórico de mudança
 * de status, então "pendente" usa o status atual do lembrete — o suficiente
 * para dar o sinal de variação de 7 dias (DB-3) sem um event log completo.
 */
function snapshotAt(contacts: Contact[], reminders: ReminderWithContact[], at: Date) {
  const pastContacts = contacts.filter((c) => new Date(c.createdAt) <= at);
  const pastPendingReminders = reminders.filter(
    (r) => r.status === "pendente" && new Date(r.createdAt) <= at,
  );
  const pastOverdue = pastPendingReminders.filter((r) => new Date(r.reminderAt) < at);
  const pastToday = pastPendingReminders.filter((r) => isSameDay(new Date(r.reminderAt), at));

  return {
    totalContacts: pastContacts.length,
    pendingReminders: pastPendingReminders.length,
    overdueReminders: pastOverdue.length,
    todayReminders: pastToday.length,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [contacts, reminders] = await Promise.all([getContacts(), getAllReminders()]);

  const contactsByCategory = emptyCategoryCounts();
  const contactsByStatus = emptyStatusCounts();
  for (const contact of contacts) {
    contactsByCategory[contact.category]++;
    contactsByStatus[contact.status]++;
  }

  const now = new Date();
  const pendingReminders = reminders.filter((r) => r.status === "pendente");
  const overdueReminders = pendingReminders.filter((r) => new Date(r.reminderAt) < now);
  const todayReminders = pendingReminders
    .filter((r) => isSameDay(new Date(r.reminderAt), now))
    .sort((a, b) => new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime());

  const recentContacts = [...contacts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const weekAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const past = snapshotAt(contacts, reminders, weekAgo);

  return {
    totalContacts: contacts.length,
    totalContactsDelta: weeklyDelta(contacts.length, past.totalContacts),
    contactsByCategory,
    contactsByStatus,
    pendingReminders: pendingReminders.length,
    pendingRemindersDelta: weeklyDelta(pendingReminders.length, past.pendingReminders),
    overdueReminders: overdueReminders.length,
    overdueRemindersDelta: weeklyDelta(overdueReminders.length, past.overdueReminders),
    todayReminders,
    todayRemindersDelta: weeklyDelta(todayReminders.length, past.todayReminders),
    recentContacts,
  };
}

export async function getReminderCounts(): Promise<ReminderCounts> {
  const reminders = await getAllReminders({ status: "pendente" });
  const now = new Date();
  const overdue = reminders.filter((r) => new Date(r.reminderAt) < now).length;
  return { pending: reminders.length, overdue };
}
