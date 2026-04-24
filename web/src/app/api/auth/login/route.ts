import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!loginRes.ok) {
    const data = await loginRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: loginRes.status });
  }

  const { access_token } = await loginRes.json();

  const meRes = await fetch(`${API_URL}/usuarios/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!meRes.ok) {
    return NextResponse.json({ detail: "Falha ao carregar perfil." }, { status: 500 });
  }

  const user = await meRes.json();

  const response = NextResponse.json({ user });
  response.cookies.set("morabilidade-auth", access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
