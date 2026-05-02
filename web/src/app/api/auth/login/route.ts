import { NextRequest, NextResponse } from "next/server";

// Forçamos 127.0.0.1 em vez de localhost para evitar o fallback IPv6 (::1) do
// Node.js no Windows, que dá ECONNREFUSED quando o uvicorn só escuta IPv4.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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
  if (!loginData?.access_token) {
    console.error("[api/auth/login] resposta da API sem access_token:", loginData);
    return NextResponse.json(
      { detail: "Resposta inesperada do servidor de autenticação." },
      { status: 502 }
    );
  }

  const access_token: string = loginData.access_token;

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
    // Mensagem específica para o caso comum de usuário no auth.users sem
    // registro correspondente em public.usuarios.
    const detail =
      typeof data === "object" && data && "detail" in data && data.detail
        ? String(data.detail)
        : "Usuário autenticado, mas sem perfil cadastrado no sistema. Procure um administrador.";
    return NextResponse.json({ detail }, { status: meRes.status });
  }

  const user = await meRes.json();

  // ── 3. Setar cookie httpOnly e responder ─────────────────────────────────
  // Sync cookie TTL with JWT exp — avoids stale-cookie 401s when Supabase
  // session expires before the 8h fallback.
  let cookieMaxAge = 60 * 60 * 8;
  try {
    const [, payloadB64] = access_token.split(".");
    const payloadStr = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadStr)) as { exp?: number };
    if (typeof payload.exp === "number") {
      const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
      if (secondsLeft > 60) cookieMaxAge = secondsLeft;
    }
  } catch {}

  // Token fica apenas no cookie httpOnly — não exposto ao JS do cliente.
  const response = NextResponse.json({ user });
  response.cookies.set("morabilidade-auth", access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: cookieMaxAge,
  });
  return response;
}
