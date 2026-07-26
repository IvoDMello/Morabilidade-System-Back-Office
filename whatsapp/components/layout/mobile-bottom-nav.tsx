"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/constants/nav";
import { cn } from "@/lib/utils";
import type { ReminderCounts } from "@/types/dashboard";

interface MobileBottomNavProps {
  reminderCounts: ReminderCounts;
  unreadConversations: number;
  pendingConversations: number;
}

export function MobileBottomNav({
  reminderCounts,
  unreadConversations,
  pendingConversations,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-veil/8 bg-sidebar px-1 pt-2 pb-2.5 md:hidden">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const count =
          item.badgeKind === "reminders"
            ? reminderCounts.pending
            : item.badgeKind === "unreadConversations"
              ? unreadConversations
              : item.badgeKind === "pendingConversations"
                ? pendingConversations
                : 0;
        const isDanger = item.badgeKind === "reminders" && reminderCounts.overdue > 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center gap-1 text-[10px]",
              isActive ? "font-semibold text-gold" : "text-ink-dim",
            )}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.8} />
            {item.label}
            {item.badgeKind && count > 0 && (
              <span
                className={cn(
                  "absolute -top-1 right-5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9.5px] font-semibold leading-none text-white",
                  item.badgeKind === "unreadConversations"
                    ? "bg-[#3a7d5c]"
                    : item.badgeKind === "pendingConversations"
                      ? "bg-[#c4553e]"
                      : isDanger
                        ? "bg-[#c4553e]"
                        : "bg-[#ae9f4a]",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
