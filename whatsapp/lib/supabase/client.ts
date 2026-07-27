"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase do navegador — usado APENAS para autenticação (login/logout,
 * recuperação de senha), no mesmo padrão das captações. Todo acesso a dados
 * acontece no servidor via getSupabaseServerClient(); a sessão criada aqui vive
 * em cookies e é validada pelo middleware.
 */
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
