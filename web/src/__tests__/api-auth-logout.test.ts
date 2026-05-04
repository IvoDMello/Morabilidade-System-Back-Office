import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/server", () => {
  class Res {
    _body: unknown;
    _status: number;
    _cookiesSet: Array<{ name: string; value: string; options: Record<string, unknown> }>;
    cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void };

    constructor(body: unknown, init?: { status?: number }) {
      this._body = body;
      this._status = init?.status ?? 200;
      this._cookiesSet = [];
      this.cookies = {
        set: (name, value, options) => {
          this._cookiesSet.push({ name, value, options });
        },
      };
    }

    get status() {
      return this._status;
    }

    async json() {
      return this._body;
    }

    static json(data: unknown, init?: { status?: number }) {
      return new Res(data, init);
    }
  }

  return { NextResponse: Res, NextRequest: Request };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { POST } from "@/app/api/auth/logout/route";
import { cookies } from "next/headers";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOKEN = "test-auth-token";
const mockFetch = vi.fn();

function makeCookieStore(token?: string) {
  return {
    get: (name: string) =>
      token && name === "morabilidade-auth" ? { value: token } : undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  vi.mocked(cookies).mockResolvedValue(makeCookieStore(TOKEN) as any);
  mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
});

afterEach(() => vi.unstubAllGlobals());

// ── Com token no cookie ───────────────────────────────────────────────────────

describe("POST /api/auth/logout — com token no cookie", () => {
  it("retorna { ok: true }", async () => {
    const res = (await POST(new Request("http://localhost") as any)) as any;
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("chama /auth/logout na API upstream com Authorization", async () => {
    await POST(new Request("http://localhost") as any);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });

  it("limpa o cookie setando maxAge=0", async () => {
    const res = (await POST(new Request("http://localhost") as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie).toBeDefined();
    expect(cookie?.options.maxAge).toBe(0);
  });

  it("cookie de limpeza é httpOnly", async () => {
    const res = (await POST(new Request("http://localhost") as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie?.options.httpOnly).toBe(true);
  });
});

// ── Sem token ─────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout — sem token", () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore() as any);
  });

  it("retorna { ok: true } mesmo sem token", async () => {
    const res = (await POST(new Request("http://localhost") as any)) as any;
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("não chama a API upstream", async () => {
    await POST(new Request("http://localhost") as any);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("ainda limpa o cookie", async () => {
    const res = (await POST(new Request("http://localhost") as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie?.options.maxAge).toBe(0);
  });
});

// ── Falha na API upstream ─────────────────────────────────────────────────────

describe("POST /api/auth/logout — falha na API upstream", () => {
  it("retorna ok mesmo que a API falhe (fire-and-forget)", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    const res = (await POST(new Request("http://localhost") as any)) as any;
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
