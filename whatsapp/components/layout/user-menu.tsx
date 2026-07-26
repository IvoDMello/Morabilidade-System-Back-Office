"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import { UserMenuItems } from "./user-menu-items";

/**
 * Rodapé do nav rail (SB-3): avatar circular do usuário com dropdown.
 * Sem autenticação nesta fase — ver constants/current-user.ts — então "Sair"
 * só confirma que ainda não há sessão para encerrar.
 */
export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            title={`${CURRENT_USER_NAME} · Corretor`}
            aria-label="Menu do usuário"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-veil/10 bg-avatar-bg text-xs font-semibold text-avatar-fg transition-colors hover:border-veil/25"
          />
        }
      >
        {CURRENT_USER_NAME.charAt(0).toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-56">
        <UserMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
