import { isBefore, isSameDay, startOfDay } from "date-fns";
import type { ReminderWithContact } from "@/types/reminder";

export interface ReminderGroups {
  overdue: ReminderWithContact[];
  today: ReminderWithContact[];
  upcoming: ReminderWithContact[];
}

/** Agrupa lembretes em vencidos, de hoje e próximos, com base na data atual. */
export function partitionReminders(reminders: ReminderWithContact[]): ReminderGroups {
  const now = new Date();
  const todayStart = startOfDay(now);

  const groups: ReminderGroups = { overdue: [], today: [], upcoming: [] };

  for (const reminder of reminders) {
    const reminderDate = new Date(reminder.reminderAt);
    if (isBefore(reminderDate, todayStart)) {
      groups.overdue.push(reminder);
    } else if (isSameDay(reminderDate, now)) {
      groups.today.push(reminder);
    } else {
      groups.upcoming.push(reminder);
    }
  }

  return groups;
}
