"use client";

import { BellOff, BellRing, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePushSubscription } from "@/features/push/use-push-subscription";

/** Itens compartilhados entre o menu do usuário desktop (sidebar) e mobile (header). */
export function UserMenuItems() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const push = usePushSubscription();

  async function handleTogglePush() {
    try {
      if (push.isSubscribed) {
        await push.unsubscribe();
        toast.success("Notificações desativadas.");
      } else {
        await push.subscribe();
        toast.success("Notificações ativadas neste dispositivo.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar as notificações.");
    }
  }

  return (
    <>
      <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isDark ? "Modo claro" : "Modo escuro"}
      </DropdownMenuItem>
      {push.isSupported && (
        <DropdownMenuItem disabled={push.isPending} onClick={handleTogglePush}>
          {push.isSubscribed ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
          {push.isSubscribed ? "Desativar notificações" : "Ativar notificações"}
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => toast.info("Sem sessão para encerrar — autenticação chega em uma fase futura.")}
      >
        <LogOut className="h-4 w-4" />
        Sair
      </DropdownMenuItem>
    </>
  );
}
