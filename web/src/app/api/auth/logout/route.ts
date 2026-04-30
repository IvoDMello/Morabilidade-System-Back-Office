import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("morabilidade-auth")?.value
    ?? request.headers.get("authorization")?.replace("Bearer ", "");

  if (token) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("morabilidade-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
