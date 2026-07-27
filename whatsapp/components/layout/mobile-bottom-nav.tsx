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
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 grid border-t border-veil/8 bg-sidebar px-0.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
    >
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
        const badgeNoun =
          item.badgeKind === "unreadConversations"
            ? "não lidas"
            : item.badgeKind === "pendingConversations"
              ? "pendentes"
              : "lembretes";

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[46px] min-w-0 flex-col items-center justify-start gap-1 px-0.5 py-0.5",
              isActive ? "font-semibold text-gold" : "text-ink-dim",
            )}
          >
            <span className="relative">
              <item.icon className="h-5 w-5" strokeWidth={1.8} />
              {item.badgeKind && count > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9.5px] font-semibold leading-none text-white",
                    item.badgeKind === "unreadConversations"
                      ? "bg-[#3a7d5c]"
                      : isDanger || item.badgeKind === "pendingConversations"
                        ? "bg-[#c4553e]"
                        : "bg-[#ae9f4a]",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            <span className="w-full text-center text-[10px] leading-tight tracking-[-0.01em]">
              {item.shortLabel ?? item.label}
            </span>
            {item.badgeKind && count > 0 && (
              <span className="sr-only">
                ({count} {badgeNoun})
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
