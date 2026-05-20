import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"];

function jwtNaoExpirado(token: string): boolean {
  try {
    const base64Payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64Payload));
    return typeof payload.exp === "number" && Date.now() < payload.exp * 1000;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (/\.(?:png|jpe?g|gif|svg|ico|webp|woff2?)$/.test(pathname)) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const accessCookie = request.cookies.get("morabilidade-auth");
  const refreshCookie = request.cookies.get("morabilidade-refresh");
  const accessValido = !!accessCookie?.value && jwtNaoExpirado(accessCookie.value);
  const podeTentarRefresh = !!refreshCookie?.value;

  if (!isPublic && !accessValido) {
    // Se tem refresh, tenta renovar via /api/auth/refresh server-side e
    // devolve o usuário na rota original. Preserva o trabalho em andamento
    // (ex.: form de imóvel) — não joga pro login à toa.
    if (podeTentarRefresh) {
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("next", pathname + search);
      return NextResponse.redirect(refreshUrl);
    }
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (accessCookie) response.cookies.delete("morabilidade-auth");
    if (refreshCookie) response.cookies.delete("morabilidade-refresh");
    return response;
  }

  // /redefinir-senha precisa funcionar mesmo se houver sessão ativa, pois o
  // usuário pode chegar aqui pelo link do e-mail enquanto está logado em outra aba.
  if (isPublic && accessValido && !pathname.startsWith("/redefinir-senha")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclui /api/* do middleware — essas rotas precisam funcionar sem cookie
  // (ex.: /api/auth/login cria o cookie após o login bem-sucedido) e elas
  // já tratam autenticação internamente quando necessário.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
