import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// NextResponse como classe real para suportar new NextResponse(...) e NextResponse.json(...)
vi.mock("next/server", () => {
  class Res {
    _body: unknown;
    _status: number;
    _headers: Headers;
    cookies = { set: vi.fn(), delete: vi.fn() };

    constructor(body: unknown, init?: { status?: number; headers?: Headers }) {
      this._body = body;
      this._status = init?.status ?? 200;
      this._headers = init?.headers ?? new Headers();
    }

    get status() {
      return this._status;
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

import { GET, POST } from "@/app/api/proxy/[...path]/route";
import { cookies } from "next/headers";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOKEN = "test-bearer-token";
const mockFetch = vi.fn();

function makeCookieStore(token?: string) {
  return {
    get: (name: string) =>
      token && name === "morabilidade-auth" ? { value: token } : undefined,
  };
}

/** Cria um Request com nextUrl injetado (propriedade específica do Next.js) */
function makeProxyReq(
  method: string,
  pathname: string,
  opts?: { auth?: string; body?: string; contentType?: string }
) {
  const url = `http://localhost${pathname}`;
  const headers: Record<string, string> = {};
  if (opts?.auth) headers["Authorization"] = `Bearer ${opts.auth}`;
  if (opts?.contentType) headers["Content-Type"] = opts.contentType;

  const req = new Request(url, { method, headers, body: opts?.body }) as any;
  req.nextUrl = new URL(url);
  return req;
}

/** Cria uma resposta upstream simulada com as interfaces necessárias */
function makeUpstreamRes(
  status: number,
  body: object,
  extraHeaders: Record<string, string> = {}
) {
  const h = new Headers(extraHeaders);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => h.get(k),
      forEach: (cb: (v: string, k: string) => void) => h.forEach(cb),
    },
    async json() {
      return body;
    },
    async arrayBuffer() {
      return new TextEncoder().encode(JSON.stringify(body)).buffer as ArrayBuffer;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  // Por padrão, nenhum token no cookie
  vi.mocked(cookies).mockResolvedValue(makeCookieStore() as any);
});

afterEach(() => vi.unstubAllGlobals());

// ── Autenticação ──────────────────────────────────────────────────────────────

describe("proxy — autenticação", () => {
  it("retorna 401 sem auth em rota protegida", async () => {
    const res = (await GET(makeProxyReq("GET", "/api/proxy/clientes"), {
      params: Promise.resolve({ path: ["clientes"] }),
    })) as any;
    expect(res._status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("permite auth/recuperar-senha sem token (rota pública da API)", async () => {
    mockFetch.mockResolvedValue(makeUpstreamRes(200, { ok: true }));
    const res = (await GET(
      makeProxyReq("GET", "/api/proxy/auth/recuperar-senha"),
      { params: Promise.resolve({ path: ["auth", "recuperar-senha"] }) }
    )) as any;
    expect(res._status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("encaminha Authorization header para o upstream", async () => {
    mockFetch.mockResolvedValue(makeUpstreamRes(200, { data: [] }));
    await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("clientes"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });

  it("usa token do cookie quando não há Authorization header", async () => {
    vi.mocked(cookies).mockResolvedValue(makeCookieStore(TOKEN) as any);
    mockFetch.mockResolvedValue(makeUpstreamRes(200, { data: [] }));
    await GET(makeProxyReq("GET", "/api/proxy/clientes"), {
      params: Promise.resolve({ path: ["clientes"] }),
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });
});

// ── Respostas upstream ────────────────────────────────────────────────────────

describe("proxy — respostas upstream", () => {
  it("repassa status 200", async () => {
    mockFetch.mockResolvedValue(makeUpstreamRes(200, { items: [] }));
    const res = (await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    })) as any;
    expect(res._status).toBe(200);
  });

  it("repassa status 422 de validação", async () => {
    mockFetch.mockResolvedValue(makeUpstreamRes(422, { detail: "campo inválido" }));
    const res = (await POST(
      makeProxyReq("POST", "/api/proxy/clientes", {
        auth: TOKEN,
        body: "{}",
        contentType: "application/json",
      }),
      { params: Promise.resolve({ path: ["clientes"] }) }
    )) as any;
    expect(res._status).toBe(422);
  });

  it("retorna 204 com body null quando upstream retorna 204", async () => {
    const h = new Headers();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      headers: {
        get: (k: string) => h.get(k),
        forEach: (cb: (v: string, k: string) => void) => h.forEach(cb),
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    });
    const res = (await POST(
      makeProxyReq("POST", "/api/proxy/clientes/1", {
        auth: TOKEN,
        body: "{}",
        contentType: "application/json",
      }),
      { params: Promise.resolve({ path: ["clientes", "1"] }) }
    )) as any;
    expect(res._status).toBe(204);
    expect(res._body).toBeNull();
  });

  it("retorna 502 quando a API está inacessível", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = (await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    })) as any;
    expect(res._status).toBe(502);
  });
});

// ── Seguimento de redirects ───────────────────────────────────────────────────

describe("proxy — seguimento de redirects", () => {
  it("segue redirecionamento 301 preservando Authorization", async () => {
    const redirectHeaders = new Headers({ location: "https://upstream/clientes" });
    mockFetch
      .mockResolvedValueOnce({
        status: 301,
        headers: {
          get: (k: string) => redirectHeaders.get(k),
          forEach: (cb: (v: string, k: string) => void) => redirectHeaders.forEach(cb),
        },
        async arrayBuffer() {
          return new ArrayBuffer(0);
        },
      })
      .mockResolvedValueOnce(makeUpstreamRes(200, { items: [] }));

    await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://upstream/clientes",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
  });

  it("limita a no máximo 6 chamadas fetch (1 + 5 redirects)", async () => {
    const redirectHeaders = new Headers({ location: "https://upstream/loop" });
    const redirectRes = {
      status: 301,
      headers: {
        get: (k: string) => redirectHeaders.get(k),
        forEach: (cb: (v: string, k: string) => void) => redirectHeaders.forEach(cb),
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    };
    // Retorna 301 para todas as chamadas — o proxy deve parar após 5 hops
    mockFetch.mockResolvedValue(redirectRes);

    await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    });

    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(6);
  });
});

// ── Remoção de headers hop-by-hop ─────────────────────────────────────────────

describe("proxy — headers hop-by-hop", () => {
  it("remove content-encoding da resposta upstream", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (k: string) => (k === "content-encoding" ? "gzip" : null),
        forEach: (cb: (v: string, k: string) => void) => {
          cb("gzip", "content-encoding");
          cb("application/json", "content-type");
        },
      },
      async arrayBuffer() {
        return new TextEncoder().encode("{}").buffer as ArrayBuffer;
      },
    });

    const res = (await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    })) as any;

    expect(res._headers.get("content-encoding")).toBeNull();
    expect(res._headers.get("content-type")).toBe("application/json");
  });

  it("remove transfer-encoding da resposta upstream", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (k: string) => (k === "transfer-encoding" ? "chunked" : null),
        forEach: (cb: (v: string, k: string) => void) => {
          cb("chunked", "transfer-encoding");
        },
      },
      async arrayBuffer() {
        return new ArrayBuffer(0);
      },
    });

    const res = (await GET(makeProxyReq("GET", "/api/proxy/clientes", { auth: TOKEN }), {
      params: Promise.resolve({ path: ["clientes"] }),
    })) as any;

    expect(res._headers.get("transfer-encoding")).toBeNull();
  });
});
