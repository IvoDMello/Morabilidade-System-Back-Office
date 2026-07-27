import { Sidebar } from "./sidebar";
import { MobileHeader } from "./mobile-header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { PageTransition } from "./page-transition";
import type { ReminderCounts } from "@/types/dashboard";

export function AppShell({
  reminderCounts,
  unreadConversations,
  pendingConversations,
  children,
}: {
  reminderCounts: ReminderCounts;
  unreadConversations: number;
  pendingConversations: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        reminderCounts={reminderCounts}
        unreadConversations={unreadConversations}
        pendingConversations={pendingConversations}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="flex-1 overflow-x-hidden p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileBottomNav
          reminderCounts={reminderCounts}
          unreadConversations={unreadConversations}
          pendingConversations={pendingConversations}
        />
      </div>
    </div>
  );
}
