import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const authHeader = request.headers.get("authorization");

  const cookieStore = await cookies();
  const tokenViaCookies = cookieStore.get("morabilidade-auth")?.value;

  const tokenViaRaw = (() => {
    const seg = cookieHeader.split(";").find(c => c.trim().startsWith("morabilidade-auth="));
    return seg ? seg.split("=").slice(1).join("=").trim() : null;
  })();

  return NextResponse.json({
    authorization_header: authHeader ? authHeader.slice(0, 30) + "..." : null,
    cookie_header_present: !!cookieHeader,
    cookie_header_has_morabilidade: cookieHeader.includes("morabilidade-auth"),
    token_via_cookies_fn: tokenViaCookies ? tokenViaCookies.slice(0, 30) + "..." : null,
    token_via_raw_header: tokenViaRaw ? tokenViaRaw.slice(0, 30) + "..." : null,
  });
}
