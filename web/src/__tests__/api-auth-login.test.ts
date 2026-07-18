import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock de NextResponse como classe inspecionável
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

import { POST } from "@/app/api/auth/login/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOKEN = "fake.access.token";
const REFRESH = "fake.refresh.token";
const EXPIRES_IN = 3600;

function makeReq(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function loginUpstreamResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: TOKEN,
    refresh_token: REFRESH,
    expires_in: EXPIRES_IN,
    ...overrides,
  };
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => vi.unstubAllGlobals());

// ── Erros de entrada ──────────────────────────────────────────────────────────

describe("POST /api/auth/login, corpo inválido", () => {
  it("retorna 400 para JSON malformado", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: "nao-e-json",
    });
    const res = (await POST(req as any)) as any;
    expect(res._status).toBe(400);
  });
});

// ── Falhas de conectividade ───────────────────────────────────────────────────

describe("POST /api/auth/login, falhas de conectividade", () => {
  it("retorna 502 quando a API não responde", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });

  it("retorna 502 quando /usuarios/me não responde", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => loginUpstreamResponse() })
      .mockRejectedValueOnce(new Error("timeout"));
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });
});

// ── Erros retornados pela API upstream ────────────────────────────────────────

describe("POST /api/auth/login, erros upstream", () => {
  it("repassa status 401 da API de autenticação", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Credenciais inválidas." }),
    });
    const res = (await POST(makeReq({ email: "a@a.com", password: "errado" }) as any)) as any;
    expect(res._status).toBe(401);
  });

  it("retorna 502 quando a resposta não contém access_token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ refresh_token: REFRESH, expires_in: EXPIRES_IN }),
    });
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });

  it("retorna 502 quando a resposta não contém refresh_token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: TOKEN, expires_in: EXPIRES_IN }),
    });
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });

  it("repassa status de /usuarios/me com detalhe", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => loginUpstreamResponse() })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Usuário sem perfil cadastrado." }),
      });
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(404);
    const body = await res.json();
    expect((body as any).detail).toMatch(/perfil/i);
  });
});

// ── Sucesso ───────────────────────────────────────────────────────────────────

describe("POST /api/auth/login, sucesso", () => {
  const user = { id: "1", nome_completo: "Admin", email: "admin@test.com", perfil: "admin" };

  beforeEach(() => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => loginUpstreamResponse() })
      .mockResolvedValueOnce({ ok: true, json: async () => user });
  });

  it("retorna 200 com dados do usuário e expires_in", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    expect(res._status).toBe(200);
    const body = await res.json();
    expect((body as any).user).toEqual(user);
    expect((body as any).expires_in).toBe(EXPIRES_IN);
  });

  it("seta o cookie morabilidade-auth com o access token", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie).toBeDefined();
    expect(cookie.value).toBe(TOKEN);
  });

  it("seta o cookie morabilidade-refresh com o refresh token", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-refresh");
    expect(cookie).toBeDefined();
    expect(cookie.value).toBe(REFRESH);
  });

  it("ambos os cookies são httpOnly + sameSite strict", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    for (const name of ["morabilidade-auth", "morabilidade-refresh"]) {
      const cookie = res._cookiesSet.find((c: any) => c.name === name);
      expect(cookie?.options.httpOnly).toBe(true);
      expect(cookie?.options.sameSite).toBe("strict");
    }
  });

  it("maxAge do cookie de access é expires_in", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie?.options.maxAge).toBe(EXPIRES_IN);
  });

  it("maxAge do cookie de refresh é 30 dias", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-refresh");
    expect(cookie?.options.maxAge).toBe(60 * 60 * 24 * 30);
  });
});
