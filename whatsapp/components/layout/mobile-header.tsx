"use client";

import { usePathname } from "next/navigation";
import { getMobileSectionInfo } from "@/constants/nav";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenuItems } from "./user-menu-items";
import { BackLink } from "./back-link";

export function MobileHeader() {
  const pathname = usePathname();
  const { title, subtitle } = getMobileSectionInfo(pathname);

  return (
    <header className="sticky top-0 z-10 border-b border-veil/6 bg-background/95 px-4 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-3 backdrop-blur-sm md:hidden">
      <div className="flex items-center justify-between gap-2">
        <BackLink className="-ml-2" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label="Menu do usuário"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-veil/10 bg-avatar-bg text-sm font-semibold text-avatar-fg"
              />
            }
          >
            {CURRENT_USER_NAME.charAt(0).toUpperCase()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-56">
            <UserMenuItems />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
