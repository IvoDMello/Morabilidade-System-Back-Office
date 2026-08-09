"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";
import type { NavCounts } from "@/constants/nav";

/**
 * Rotas full-bleed que NÃO usam o chrome do app (sidebar, header e nav mobile).
 * O login precisa ocupar a viewport inteira; renderizar o AppShell atrás dele
 * criava altura de página extra (e barra de rolagem fantasma no mobile).
 */
const FULL_BLEED_ROUTES = ["/login"];

function isFullBleed(pathname: string): boolean {
  return FULL_BLEED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function ConditionalShell({
  countsPromise,
  children,
}: {
  countsPromise: Promise<NavCounts>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (isFullBleed(pathname)) {
    return <>{children}</>;
  }

  return <AppShell countsPromise={countsPromise}>{children}</AppShell>;
}
