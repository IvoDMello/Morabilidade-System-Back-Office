"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getNavBadge, type NavCounts } from "@/constants/nav";
import { cn } from "@/lib/utils";

/** Itens do nav rail: ícone 40px com barra dourada à esquerda quando ativo e
 * contador em selo no canto (verde = mensagens novas, vermelho = pendências). */
export function NavLinks(counts: NavCounts) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const badge = getNavBadge(item, counts);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            // O rótulo carrega o contador: com aria-label o selo numérico não
            // seria lido, e o leitor de tela perderia a informação toda.
            aria-label={
              badge && badge.count > 0
                ? `${item.label} (${badge.count} ${badge.noun})`
                : item.label
            }
            aria-current={isActive ? "page" : undefined}
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
            {badge && badge.count > 0 && (
              <span
                className={cn(
                  "absolute right-[1px] top-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-sidebar px-[3px] text-[9.5px] font-semibold leading-none text-white",
                  badge.tone === "unread" ? "bg-[#3a7d5c]" : "bg-[#c4553e]",
                )}
              >
                {badge.count > 99 ? "99+" : badge.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
