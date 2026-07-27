import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresca a sessão do Supabase e protege as rotas (padrão das captações).
 * O CRM original não tinha autenticação nenhuma — pendência bloqueadora
 * corrigida na integração ao monorepo (2026-07-25).
 *
 * Fora do guard de login (têm autenticação própria):
 *  - /api/whatsapp/webhook  → assinatura X-Hub-Signature-256 da Meta
 *  - /api/cron/*            → CRON_SECRET (lib/cron-auth.ts)
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Exclui: estáticos, assets do PWA (manifest/sw/icons — senão o navegador não
  // oferece instalação), o webhook da Meta e os crons (auth própria).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/whatsapp/webhook|api/cron|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
