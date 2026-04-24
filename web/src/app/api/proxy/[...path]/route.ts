import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HOP_BY_HOP = new Set(["content-encoding", "transfer-encoding", "connection", "keep-alive"]);

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const token = request.cookies.get("morabilidade-auth")?.value;

  const targetUrl = new URL(`${API_URL}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

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
    const res = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
    });

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
