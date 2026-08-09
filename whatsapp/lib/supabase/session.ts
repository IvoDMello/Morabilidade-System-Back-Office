import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Lê o usuário autenticado (Supabase Auth) a partir do cookie da requisição —
 * mesmo mecanismo do middleware, mas para uso em Server Components/Actions que
 * precisam saber "quem sou eu" (ex.: resolver o corretor logado).
 *
 * Best-effort: sem env do Supabase ou sem sessão, retorna null. Diferente de
 * lib/supabase/server.ts (service_role, sem contexto de usuário), este cliente
 * usa a anon key + cookie para respeitar a identidade do login.
 */
export async function getCurrentAuthUser(): Promise<{ id: string; email: string | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Server Component/Action não escreve cookie de sessão aqui — o refresh
      // fica a cargo do middleware. No-op evita erro em contexto read-only.
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}
