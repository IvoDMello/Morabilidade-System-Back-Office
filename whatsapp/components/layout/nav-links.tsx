"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/constants/nav";
import { cn } from "@/lib/utils";
import type { ReminderCounts } from "@/types/dashboard";

interface NavLinksProps {
  reminderCounts: ReminderCounts;
  unreadConversations: number;
  pendingConversations: number;
}

/** Itens do nav rail: ícone 40px com barra dourada à esquerda quando ativo e
 * contador em selo no canto (verde = conversas, vermelho = lembretes vencidos/pendências). */
export function NavLinks({ reminderCounts, unreadConversations, pendingConversations }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center gap-1">
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
            title={item.label}
            aria-label={item.label}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-ink-dim hover:bg-veil/6 hover:text-ink-mid",
            )}
          >
            {isActive && (
              <span className="absolute -left-2.5 top-[9px] h-[22px] w-[3px] rounded-full bg-sidebar-primary" />
            )}
            <item.icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
            {item.badgeKind && count > 0 && (
              <span
                className={cn(
                  "absolute right-[1px] top-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-sidebar px-[3px] text-[9.5px] font-semibold leading-none text-white",
                  item.badgeKind === "unreadConversations"
                    ? "bg-[#3a7d5c]"
                    : item.badgeKind === "pendingConversations"
                      ? "bg-[#ef7a7a]"
                      : isDanger
                        ? "bg-[#ef7a7a]"
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
