"use client";

import { Suspense, use } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getNavBadge, type NavCounts, type NavItem } from "@/constants/nav";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ countsPromise }: { countsPromise: Promise<NavCounts> }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 grid border-t border-veil/8 bg-sidebar px-0.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className="flex min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <MobileNavItem item={item} isActive={isActive} countsPromise={countsPromise} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Mesmo motivo do nav rail do desktop: filho do <Link> para ler o
 * useLinkStatus e acender o item no clique, sem esperar a tela nova. */
function MobileNavItem({
  item,
  isActive,
  countsPromise,
}: {
  item: NavItem;
  isActive: boolean;
  countsPromise: Promise<NavCounts>;
}) {
  const { pending } = useLinkStatus();
  const lit = isActive || pending;

  return (
    <span
      className={cn(
        "flex min-h-[46px] w-full min-w-0 flex-col items-center justify-start gap-1 px-0.5 py-0.5 transition-[color,transform] duration-150 active:scale-90 active:duration-0",
        lit ? "font-semibold text-gold" : "text-ink-dim",
      )}
    >
      <span className={cn("relative", pending && !isActive && "animate-pulse")}>
        <item.icon className="h-5 w-5" strokeWidth={1.8} />
        <Suspense fallback={null}>
          <MobileNavBadge item={item} countsPromise={countsPromise} />
        </Suspense>
      </span>
      <span className="w-full text-center text-[10px] leading-tight tracking-[-0.01em]">
        {item.shortLabel ?? item.label}
      </span>
    </span>
  );
}

/** Selo numérico — suspende sozinho para não segurar a barra inteira. */
function MobileNavBadge({
  item,
  countsPromise,
}: {
  item: NavItem;
  countsPromise: Promise<NavCounts>;
}) {
  const badge = getNavBadge(item, use(countsPromise));
  if (!badge || badge.count === 0) return null;

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-[9.5px] font-semibold leading-none text-white",
          badge.tone === "unread" ? "bg-[#3a7d5c]" : "bg-[#ef7a7a]",
        )}
      >
        {badge.count > 99 ? "99+" : badge.count}
      </span>
      <span className="sr-only">
        ({badge.count} {badge.noun})
      </span>
    </>
  );
}
