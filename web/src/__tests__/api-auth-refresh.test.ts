import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de NextResponse + cookies() do next/headers
const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value !== undefined ? { value } : undefined;
    },
  }),
}));

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

    get status() { return this._status; }
    async json() { return this._body; }

    static json(data: unknown, init?: { status?: number }) {
      return new Res(data, init);
    }
  }

  return { NextResponse: Res, NextRequest: Request };
});

import { POST } from "@/app/api/auth/refresh/route";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  cookieStore.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/auth/refresh", () => {
  it("retorna 401 quando não há cookie de refresh", async () => {
    const res = (await POST()) as any;
    expect(res._status).toBe(401);
  });

  it("retorna 401 e limpa cookies quando o upstream rejeita o refresh", async () => {
    cookieStore.set("morabilidade-refresh", "refresh-velho");
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Sessão expirada." }),
    });

    const res = (await POST()) as any;
    expect(res._status).toBe(401);

    const cleared = res._cookiesSet.map((c: any) => c.name).sort();
    expect(cleared).toEqual(["morabilidade-auth", "morabilidade-refresh"]);
    for (const c of res._cookiesSet) {
      expect(c.options.maxAge).toBe(0);
    }
  });

  it("retorna 502 quando o upstream cai (sem limpar cookies)", async () => {
    cookieStore.set("morabilidade-refresh", "refresh-valido");
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = (await POST()) as any;
    expect(res._status).toBe(502);
    // 502 = problema de infra, não de credencial. Não derruba a sessão.
    expect(res._cookiesSet.length).toBe(0);
  });

  it("renova ambos os cookies em sucesso e retorna expires_in", async () => {
    cookieStore.set("morabilidade-refresh", "refresh-velho");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access-novo",
        refresh_token: "refresh-novo",
        expires_in: 3600,
      }),
    });

    const res = (await POST()) as any;
    expect(res._status).toBe(200);
    const body = await res.json();
    expect((body as any).expires_in).toBe(3600);

    const accessCookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    const refreshCookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-refresh");
    expect(accessCookie?.value).toBe("access-novo");
    expect(refreshCookie?.value).toBe("refresh-novo");
    expect(accessCookie?.options.httpOnly).toBe(true);
    expect(refreshCookie?.options.httpOnly).toBe(true);
  });

  it("retorna 502 se o upstream responder sem tokens válidos", async () => {
    cookieStore.set("morabilidade-refresh", "refresh-velho");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "so-access" }), // sem refresh_token
    });

    const res = (await POST()) as any;
    expect(res._status).toBe(502);
  });
});
