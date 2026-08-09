import { MessageCircle } from "lucide-react";
import { NavLinks } from "./nav-links";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import type { NavCounts } from "@/constants/nav";

/** Nav rail do redesign: 60px, só ícones, logo no topo e usuário no rodapé. */
export function Sidebar({ countsPromise }: { countsPromise: Promise<NavCounts> }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[60px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3.5 text-sidebar-foreground md:flex">
      <div
        className="mb-2 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[linear-gradient(150deg,#f0e7b8,#e7dda6)] text-[#1b1c16] shadow-[0_2px_8px_rgba(231,221,166,0.35)]"
        title="WhatsApp Morabilidade"
      >
        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </div>
      <CommandPalette />
      <div className="my-1.5 h-px w-8 bg-veil/8" />
      <NavLinks countsPromise={countsPromise} />
      <div className="flex-1" />
      <UserMenu />
    </aside>
  );
}
