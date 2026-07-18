import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted garante que mocks estão disponíveis antes dos imports (hoisting do vi.mock)
const mocks = vi.hoisted(() => ({
  next: vi.fn(() => ({ _action: "next" })),
  redirect: vi.fn((url: URL) => ({
    _action: "redirect",
    _url: url.href,
    cookies: { delete: vi.fn() },
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: { next: mocks.next, redirect: mocks.redirect },
}));

import { middleware } from "@/middleware";
import type { NextRequest } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJwt(exp: number): string {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256" })}.${enc({ sub: "u1", exp })}.sig`;
}

const VALID_TOKEN = makeJwt(Math.floor(Date.now() / 1000) + 3600);
const EXPIRED_TOKEN = makeJwt(Math.floor(Date.now() / 1000) - 3600);
const REFRESH = "fake.refresh.cookie";

interface ReqOpts {
  accessToken?: string;
  refreshToken?: string;
  search?: string;
}

function req(pathname: string, opts: ReqOpts = {}): NextRequest {
  const { accessToken, refreshToken, search = "" } = opts;
  return {
    nextUrl: { pathname, search },
    cookies: {
      get: (name: string) => {
        if (name === "morabilidade-auth" && accessToken) {
          return { name, value: accessToken };
        }
        if (name === "morabilidade-refresh" && refreshToken) {
          return { name, value: refreshToken };
        }
        return undefined;
      },
    },
    url: `http://localhost${pathname}${search}`,
  } as unknown as NextRequest;
}

beforeEach(() => vi.clearAllMocks());

// ── Arquivos estáticos ────────────────────────────────────────────────────────

describe("middleware, arquivos estáticos", () => {
  it("passa .png sem verificar token", () => {
    middleware(req("/logo.png"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("passa .woff2 sem verificar token", () => {
    middleware(req("/font.woff2"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("passa .svg sem verificar token", () => {
    middleware(req("/icon.svg"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });
});

// ── Rota protegida sem nenhum cookie ──────────────────────────────────────────

describe("middleware, rota protegida sem token nem refresh", () => {
  it("redireciona / para /login", () => {
    const res = middleware(req("/")) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });

  it("redireciona /clientes para /login", () => {
    const res = middleware(req("/clientes")) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });

  it("redireciona /imoveis/novo para /login", () => {
    const res = middleware(req("/imoveis/novo")) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });
});

// ── Token expirado SEM refresh ────────────────────────────────────────────────

describe("middleware, token expirado sem cookie de refresh", () => {
  it("redireciona para /login", () => {
    const res = middleware(req("/", { accessToken: EXPIRED_TOKEN })) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });

  it("apaga o cookie expirado", () => {
    const res = middleware(req("/", { accessToken: EXPIRED_TOKEN })) as any;
    expect(res.cookies.delete).toHaveBeenCalledWith("morabilidade-auth");
  });
});

// ── Token expirado COM refresh ───────────────────────────────────────────────

describe("middleware, token expirado com cookie de refresh", () => {
  it("redireciona para /api/auth/refresh preservando rota original", () => {
    const res = middleware(
      req("/imoveis/novo", { accessToken: EXPIRED_TOKEN, refreshToken: REFRESH }),
    ) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/api/auth/refresh");
    expect(decodeURIComponent(res._url)).toContain("next=/imoveis/novo");
  });

  it("preserva query string em next=", () => {
    const res = middleware(
      req("/clientes", {
        accessToken: EXPIRED_TOKEN,
        refreshToken: REFRESH,
        search: "?filter=admin",
      }),
    ) as any;
    expect(decodeURIComponent(res._url)).toContain("next=/clientes?filter=admin");
  });

  it("não tenta refresh quando não tem access cookie nem refresh", () => {
    // Sem nenhum cookie => /login direto
    const res = middleware(req("/")) as any;
    expect(res._url).toContain("/login");
    expect(res._url).not.toContain("/api/auth/refresh");
  });

  it("tenta refresh mesmo sem access cookie, se houver refresh", () => {
    // Aba reaberta depois do access cookie ter expirado por TTL, só o
    // refresh sobreviveu. Deve tentar restaurar a sessão.
    const res = middleware(req("/imoveis", { refreshToken: REFRESH })) as any;
    expect(res._url).toContain("/api/auth/refresh");
  });
});

// ── Token malformado ──────────────────────────────────────────────────────────

describe("middleware, token malformado", () => {
  it("trata token inválido como ausente e redireciona", () => {
    const res = middleware(req("/", { accessToken: "nao.e.um.jwt.valido" })) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });

  it("token inválido + refresh válido → tenta refresh", () => {
    const res = middleware(
      req("/", { accessToken: "nao.e.um.jwt.valido", refreshToken: REFRESH }),
    ) as any;
    expect(res._url).toContain("/api/auth/refresh");
  });
});

// ── Token válido em rota protegida ────────────────────────────────────────────

describe("middleware, token válido em rota protegida", () => {
  it("deixa passar /", () => {
    middleware(req("/", { accessToken: VALID_TOKEN }));
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("deixa passar /imoveis/novo", () => {
    middleware(req("/imoveis/novo", { accessToken: VALID_TOKEN }));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("deixa passar /clientes/123", () => {
    middleware(req("/clientes/123", { accessToken: VALID_TOKEN }));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });
});

// ── Rotas públicas com token válido ───────────────────────────────────────────

describe("middleware, rotas públicas com token válido", () => {
  it("redireciona /login → / quando já autenticado", () => {
    const res = middleware(req("/login", { accessToken: VALID_TOKEN })) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toBe("http://localhost/");
  });

  it("redireciona /recuperar-senha → / quando já autenticado", () => {
    const res = middleware(req("/recuperar-senha", { accessToken: VALID_TOKEN })) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toBe("http://localhost/");
  });

  it("permite /redefinir-senha mesmo autenticado (link do e-mail)", () => {
    middleware(req("/redefinir-senha", { accessToken: VALID_TOKEN }));
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

// ── Rotas públicas sem token ──────────────────────────────────────────────────

describe("middleware, rotas públicas sem token", () => {
  it("permite /login sem token", () => {
    middleware(req("/login"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("permite /recuperar-senha sem token", () => {
    middleware(req("/recuperar-senha"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("permite /redefinir-senha sem token", () => {
    middleware(req("/redefinir-senha"));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });
});
