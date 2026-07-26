import { MessageCircle } from "lucide-react";
import { NavLinks } from "./nav-links";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import type { ReminderCounts } from "@/types/dashboard";

/** Nav rail do redesign: 60px, só ícones, logo no topo e usuário no rodapé. */
export function Sidebar({
  reminderCounts,
  unreadConversations,
  pendingConversations,
}: {
  reminderCounts: ReminderCounts;
  unreadConversations: number;
  pendingConversations: number;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[60px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3.5 text-sidebar-foreground md:flex">
      <div
        className="mb-2 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[linear-gradient(150deg,#e8dea0,#d8cb6a)] text-[#2e302a] shadow-[0_2px_8px_rgba(216,203,106,0.35)]"
        title="WhatsApp Morabilidade"
      >
        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </div>
      <CommandPalette />
      <div className="my-1.5 h-px w-8 bg-veil/8" />
      <NavLinks
        reminderCounts={reminderCounts}
        unreadConversations={unreadConversations}
        pendingConversations={pendingConversations}
      />
      <div className="flex-1" />
      <UserMenu />
    </aside>
  );
}
