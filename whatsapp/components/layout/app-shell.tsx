import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { PageTransition } from "./page-transition";
import { BackLink } from "./back-link";
import type { NavCounts } from "@/constants/nav";

export function AppShell({
  countsPromise,
  children,
}: {
  countsPromise: Promise<NavCounts>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar countsPromise={countsPromise} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="flex-1 overflow-x-hidden p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {/* No desktop não existe header, então a seta mora no topo do
              conteúdo — com rótulo, que aqui há espaço. No mobile ela vive no
              MobileHeader, ao lado do título. */}
          <BackLink withLabel className="-ml-2.5 mb-2 hidden md:flex" />
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileBottomNav countsPromise={countsPromise} />
      </div>
    </div>
  );
}
