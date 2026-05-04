import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HOP_BY_HOP = new Set(["content-encoding", "transfer-encoding", "connection", "keep-alive"]);

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Prioridade 1: Authorization header enviado pelo cliente (Axios interceptor)
  // Prioridade 2: cookies() do Next.js 15 (mais confiável que request.cookies em Route Handlers)
  // Prioridade 3: parse manual do header Cookie (fallback garantido)
  let authHeader = request.headers.get("authorization");
  if (!authHeader) {
    const cookieStore = await cookies();
    const token = cookieStore.get("morabilidade-auth")?.value;
    if (token) authHeader = `Bearer ${token}`;
  }
  if (!authHeader) {
    const rawCookie = request.headers.get("cookie") ?? "";
    const seg = rawCookie.split(";").find(c => c.trim().startsWith("morabilidade-auth="));
    if (seg) {
      const val = seg.split("=").slice(1).join("=").trim();
      if (val) authHeader = `Bearer ${val}`;
    }
  }
  const publicPaths = new Set(["auth/recuperar-senha"]);
  const isPublic = publicPaths.has(path.join("/"));
  if (!authHeader && !isPublic) {
    return NextResponse.json({ detail: "Não autorizado." }, { status: 401 });
  }

  // A API tem redirect_slashes=False, então a barra final precisa ser preservada
  const trailingSlash = request.nextUrl.pathname.endsWith("/") ? "/" : "";
  const targetUrl = new URL(`${API_URL}/${path.join("/")}${trailingSlash}`);
  request.nextUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const headers: Record<string, string> = {};
  if (authHeader) headers["Authorization"] = authHeader;

  const contentType = request.headers.get("content-type") ?? "";
  const hasBody = !["GET", "HEAD", "DELETE"].includes(request.method);

  let body: BodyInit | undefined;
  if (hasBody) {
    if (contentType.includes("multipart/form-data")) {
      body = await request.formData();
      // Não define Content-Type — o fetch seta automaticamente com o boundary correto
    } else {
      const text = await request.text();
      if (text) {
        body = text;
        headers["Content-Type"] = contentType || "application/json";
      }
    }
  }

  try {
    // redirect:"manual" preserves the Authorization header on HTTP→HTTPS redirects.
    // Node.js fetch (undici) strips it on cross-origin redirects just like browsers do.
    let res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });

    // Follow redirects manually so Authorization header survives (e.g. Railway HTTP→HTTPS)
    let hops = 0;
    while (res.status >= 301 && res.status <= 308 && hops < 5) {
      const location = res.headers.get("location");
      if (!location) break;
const redirectMethod = res.status === 303 ? "GET" : request.method;
      const redirectBody = res.status === 303 ? undefined : body;
      res = await fetch(location, {
        method: redirectMethod,
        headers,
        body: redirectBody,
        redirect: "manual",
      });
      hops++;
    }

    if (res.status === 204) {
      const resHeaders = new Headers();
      res.headers.forEach((v, k) => { if (!HOP_BY_HOP.has(k)) resHeaders.set(k, v); });
      return new NextResponse(null, { status: 204, headers: resHeaders });
    }

    const resHeaders = new Headers();
    res.headers.forEach((v, k) => { if (!HOP_BY_HOP.has(k)) resHeaders.set(k, v); });

    const resBody = await res.arrayBuffer();
    return new NextResponse(resBody, { status: res.status, headers: resHeaders });
  } catch {
    return NextResponse.json({ detail: "Erro de conectividade com a API." }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
