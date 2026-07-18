import { createClient } from "@supabase/supabase-js";

/**
 * Client com service_role, ignora RLS. Uso EXCLUSIVO no servidor
 * (cron de arquivamento, tarefas administrativas). Nunca importar no cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "captacoes" }, auth: { persistSession: false } }
  );
}
