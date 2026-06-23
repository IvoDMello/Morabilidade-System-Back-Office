import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase no servidor (route handlers / server components), com sessão via cookies. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "captacoes" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            );
          } catch {
            // chamado de um Server Component — ignorável quando há middleware de refresh.
          }
        },
      },
    }
  );
}
