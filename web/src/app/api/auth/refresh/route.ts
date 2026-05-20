import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const COOKIE_ACCESS = "morabilidade-auth";
const COOKIE_REFRESH = "morabilidade-refresh";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function clearCookies(response: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  for (const name of [COOKIE_ACCESS, COOKIE_REFRESH]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
}

/**
 * Troca o refresh_token (cookie httpOnly) por um novo par access/refresh.
 *
 * Caminho server-side: o refresh_token NUNCA é exposto ao JS do cliente.
 * Sucesso → 200 com `{ expires_in }` e cookies renovados.
 * Falha   → 401 com cookies limpos. Cliente decide redirecionar pro login.
 *
 * GET é suportado para suportar redirect do middleware: `/api/auth/refresh?next=<rota>`
 * faz o refresh e redireciona o usuário pra `next` em vez de jogar pro login.
 */
async function doRefresh(): Promise<
  | { ok: true; access_token: string; refresh_token: string; expires_in: number }
  | { ok: false; status: number }
> {
  const cookieStore = await cookies();
  const refresh_token = cookieStore.get(COOKIE_REFRESH)?.value;
  if (!refresh_token) {
    return { ok: false, status: 401 };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[api/auth/refresh] falha de conectividade:", err);
    return { ok: false, status: 502 };
  }

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  const data = await res.json().catch(() => null);
  if (!data?.access_token || !data?.refresh_token) {
    return { ok: false, status: 502 };
  }

  return {
    ok: true,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: Number(data.expires_in) || 3600,
  };
}

function setCookies(
  response: NextResponse,
  access_token: string,
  refresh_token: string,
  expires_in: number,
) {
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set(COOKIE_ACCESS, access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: expires_in,
  });
  response.cookies.set(COOKIE_REFRESH, refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
}

export async function POST() {
  const result = await doRefresh();
  if (!result.ok) {
    const response = NextResponse.json(
      { detail: "Sessão expirada." },
      { status: result.status === 502 ? 502 : 401 },
    );
    if (result.status !== 502) clearCookies(response);
    return response;
  }

  const response = NextResponse.json({ expires_in: result.expires_in });
  setCookies(response, result.access_token, result.refresh_token, result.expires_in);
  return response;
}

export async function GET(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/";
  // Sanitiza: só aceita paths relativos pra evitar open redirect.
  const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/";

  const result = await doRefresh();
  if (!result.ok) {
    const loginUrl = new URL("/login", request.url);
    if (safeNext !== "/") loginUrl.searchParams.set("next", safeNext);
    const response = NextResponse.redirect(loginUrl);
    if (result.status !== 502) clearCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(safeNext, request.url));
  setCookies(response, result.access_token, result.refresh_token, result.expires_in);
  return response;
}
