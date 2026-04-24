import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/recuperar-senha"];

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
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const tokenCookie = request.cookies.get("morabilidade-auth");
  const tokenValido = !!tokenCookie?.value && jwtNaoExpirado(tokenCookie.value);

  if (!isPublic && !tokenValido) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (tokenCookie) response.cookies.delete("morabilidade-auth");
    return response;
  }

  if (isPublic && tokenValido) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
