"use client";

import { Suspense, use } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getNavBadge, type NavCounts, type NavItem } from "@/constants/nav";
import { cn } from "@/lib/utils";

/** Itens do nav rail: ícone 40px com barra dourada à esquerda quando ativo e
 * contador em selo no canto (verde = mensagens novas, vermelho = pendências). */
export function NavLinks({ countsPromise }: { countsPromise: Promise<NavCounts> }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={isActive ? "page" : undefined}
            className="flex rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <NavRailItem item={item} isActive={isActive} countsPromise={countsPromise} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Precisa ser filho do <Link> para poder ler o useLinkStatus. O destaque
 * acende no clique em vez de esperar o pathname mudar — como o pathname só
 * muda quando a tela nova chega do servidor, sem isso o clique fica alguns
 * décimos sem resposta nenhuma e parece que não registrou. */
function NavRailItem({
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
        "relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-[background-color,color,transform] duration-150 active:scale-90 active:duration-0",
        lit
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-ink-dim hover:bg-veil/6 hover:text-ink-mid",
      )}
    >
      {lit && (
        <span
          className={cn(
            "absolute -left-2.5 top-[9px] h-[22px] w-[3px] rounded-full bg-sidebar-primary",
            // Pulsa só enquanto a tela não chegou: confirma o clique e ao mesmo
            // tempo avisa que ainda está carregando.
            pending && !isActive && "animate-pulse",
          )}
        />
      )}
      <item.icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
      {/* O nome acessível vem do conteúdo, não de um aria-label: o contador
          chega depois (streaming) e um aria-label fixo o esconderia do leitor
          de tela — aria-label sobrepõe o conteúdo em vez de somar. */}
      <span className="sr-only">{item.label}</span>
      <Suspense fallback={null}>
        <NavRailBadge item={item} countsPromise={countsPromise} />
      </Suspense>
    </span>
  );
}

/** Selo numérico. Suspende sozinho até os contadores chegarem, para que o rail
 * inteiro não fique esperando três consultas ao banco para aparecer. */
function NavRailBadge({
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
          "absolute right-[1px] top-[1px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-sidebar px-[3px] text-[9.5px] font-semibold leading-none text-white",
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
