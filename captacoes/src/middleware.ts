import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresca a sessão do Supabase e protege as rotas.
 * Usuários não autenticados são enviados para /login.
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /redefinir-senha precisa ser pública: o link de recuperação chega com um
  // código na URL que só vira sessão depois que a página carrega no cliente.
  const isPublica =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/redefinir-senha");
  if (!user && !isPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Exclui assets do PWA (manifest e service worker) além dos estáticos — senão
  // o middleware redireciona /manifest.webmanifest e /sw.js para /login (307) e
  // o navegador não consegue oferecer a instalação do app.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
