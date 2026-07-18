import { NextRequest, NextResponse } from "next/server";

// Forçamos 127.0.0.1 em vez de localhost para evitar o fallback IPv6 (::1) do
// Node.js no Windows, que dá ECONNREFUSED quando o uvicorn só escuta IPv4.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const COOKIE_ACCESS = "morabilidade-auth";
const COOKIE_REFRESH = "morabilidade-refresh";
// Refresh token vive 30 dias no cookie. O Supabase rotaciona a cada uso e
// invalida o anterior, se for roubado e usado, o legítimo cai junto na
// próxima tentativa de refresh, encurtando a janela de exposição.
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  // ── 1. Login na API FastAPI ──────────────────────────────────────────────
  let loginRes: Response;
  try {
    loginRes = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[api/auth/login] falha ao conectar na API:", err);
    return NextResponse.json(
      {
        detail:
          "Não foi possível conectar ao servidor. Verifique se a API está rodando em " +
          API_URL +
          ".",
      },
      { status: 502 }
    );
  }

  if (!loginRes.ok) {
    const data = await loginRes.json().catch(() => ({}));
    console.warn(
      "[api/auth/login] API retornou %d: %o",
      loginRes.status,
      data
    );
    return NextResponse.json(data, { status: loginRes.status });
  }

  const loginData = await loginRes.json().catch(() => null);
  if (!loginData?.access_token || !loginData?.refresh_token) {
    console.error("[api/auth/login] resposta da API sem tokens:", loginData);
    return NextResponse.json(
      { detail: "Resposta inesperada do servidor de autenticação." },
      { status: 502 }
    );
  }

  const access_token: string = loginData.access_token;
  const refresh_token: string = loginData.refresh_token;
  const expires_in: number = Number(loginData.expires_in) || 3600;

  // ── 2. Buscar perfil do usuário ──────────────────────────────────────────
  let meRes: Response;
  try {
    meRes = await fetch(`${API_URL}/usuarios/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[api/auth/login] falha ao conectar em /usuarios/me:", err);
    return NextResponse.json(
      { detail: "Não foi possível carregar o perfil do usuário." },
      { status: 502 }
    );
  }

  if (!meRes.ok) {
    const data = await meRes.json().catch(() => ({}));
    console.warn(
      "[api/auth/login] /usuarios/me retornou %d: %o",
      meRes.status,
      data
    );
    const detail =
      typeof data === "object" && data && "detail" in data && data.detail
        ? String(data.detail)
        : "Usuário autenticado, mas sem perfil cadastrado no sistema. Procure um administrador.";
    return NextResponse.json({ detail }, { status: meRes.status });
  }

  const user = await meRes.json();

  // ── 3. Setar cookies httpOnly e responder ───────────────────────────────
  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ user, expires_in });

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
  return response;
}
