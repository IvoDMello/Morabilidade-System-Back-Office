import { dataSource } from "./data";
import { getCurrentAuthUser } from "@/lib/supabase/session";
import { CURRENT_USER_NAME } from "@/constants/current-user";
import type { Corretor } from "@/types/corretor";

/** Lista os corretores ativos (para pickers e filtros). */
export function getCorretores(): Promise<Corretor[]> {
  return dataSource.corretores.list();
}

/**
 * Corretor correspondente ao usuário logado (via auth_user_id). null quando não
 * há sessão ou o login ainda não foi ligado a um corretor — nesse caso a
 * atribuição automática simplesmente não acontece (o corretor pode ser escolhido
 * à mão na UI).
 */
export async function getCurrentCorretor(): Promise<Corretor | null> {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  return dataSource.corretores.getByAuthUserId(user.id);
}

/** Nome para atribuir a `created_by` — o corretor logado, ou o fallback histórico. */
export async function getCurrentUserName(): Promise<string> {
  const corretor = await getCurrentCorretor();
  return corretor?.nome ?? CURRENT_USER_NAME;
}
