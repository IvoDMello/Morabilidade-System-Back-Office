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

function makeJwt(exp: number): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256" })}.${enc({ sub: "u1", exp })}.sig`;
}

const TOKEN = makeJwt(Math.floor(Date.now() / 1000) + 3600);

function makeReq(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => vi.unstubAllGlobals());

// ── Erros de entrada ──────────────────────────────────────────────────────────

describe("POST /api/auth/login — corpo inválido", () => {
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

describe("POST /api/auth/login — falhas de conectividade", () => {
  it("retorna 502 quando a API não responde", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });

  it("retorna 502 quando /usuarios/me não responde", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: TOKEN }) })
      .mockRejectedValueOnce(new Error("timeout"));
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });
});

// ── Erros retornados pela API upstream ────────────────────────────────────────

describe("POST /api/auth/login — erros upstream", () => {
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
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const res = (await POST(makeReq({ email: "a@a.com", password: "123456" }) as any)) as any;
    expect(res._status).toBe(502);
  });

  it("repassa status de /usuarios/me com detalhe", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: TOKEN }) })
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

describe("POST /api/auth/login — sucesso", () => {
  const user = { id: "1", nome_completo: "Admin", email: "admin@test.com", perfil: "admin" };

  beforeEach(() => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: TOKEN }) })
      .mockResolvedValueOnce({ ok: true, json: async () => user });
  });

  it("retorna 200 com dados do usuário", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    expect(res._status).toBe(200);
    const body = await res.json();
    expect((body as any).user).toEqual(user);
  });

  it("seta o cookie morabilidade-auth com o token", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie).toBeDefined();
    expect(cookie.value).toBe(TOKEN);
  });

  it("cookie é httpOnly", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie?.options.httpOnly).toBe(true);
  });

  it("cookie usa sameSite strict", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    expect(cookie?.options.sameSite).toBe("strict");
  });

  it("maxAge do cookie é derivado do exp do JWT (~3600s)", async () => {
    const res = (await POST(makeReq({ email: "admin@test.com", password: "pass123" }) as any)) as any;
    const cookie = res._cookiesSet.find((c: any) => c.name === "morabilidade-auth");
    // Permite até 5s de margem para a execução do teste
    expect(cookie?.options.maxAge).toBeGreaterThan(3595);
    expect(cookie?.options.maxAge).toBeLessThanOrEqual(3600);
  });
});
