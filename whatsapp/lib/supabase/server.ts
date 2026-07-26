import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// O 3º parâmetro genérico fixa o schema `whatsapp` (sem ele o tipo default é
// "public" e o singleton não compila).
type WhatsappClient = SupabaseClient<any, any, "whatsapp">;

let serverClient: WhatsappClient | null = null;

/**
 * Cliente Supabase para uso EXCLUSIVO no servidor (Server Components, Server
 * Actions, route handlers, crons e webhook).
 *
 * Integração ao monorepo (2026-07-25): usa a service_role key (ignora RLS) e o
 * schema `whatsapp` do Supabase PRINCIPAL do sistema — ver
 * supabase/migrations/0000_schema.sql. A proteção de acesso vem de cima:
 * middleware.ts exige login nas páginas, o webhook valida assinatura da Meta e
 * os crons validam CRON_SECRET. Nunca importar este módulo em Client Component.
 */
export function getSupabaseServerClient(): WhatsappClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseServerClient() não pode ser usado no navegador.");
  }
  if (!serverClient) {
    serverClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "whatsapp" }, auth: { persistSession: false } },
    );
  }
  return serverClient;
}
