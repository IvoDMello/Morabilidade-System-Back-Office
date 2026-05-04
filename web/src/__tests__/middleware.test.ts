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

function req(pathname: string, token?: string): NextRequest {
  return {
    nextUrl: { pathname },
    cookies: {
      get: (name: string) =>
        token && name === "morabilidade-auth"
          ? { name: "morabilidade-auth", value: token }
          : undefined,
    },
    url: `http://localhost${pathname}`,
  } as unknown as NextRequest;
}

beforeEach(() => vi.clearAllMocks());

// ── Arquivos estáticos ────────────────────────────────────────────────────────

describe("middleware — arquivos estáticos", () => {
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

// ── Rota protegida sem token ──────────────────────────────────────────────────

describe("middleware — rota protegida sem token", () => {
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

  it("não apaga cookie quando não havia cookie", () => {
    const res = middleware(req("/")) as any;
    expect(res.cookies.delete).not.toHaveBeenCalled();
  });
});

// ── Token expirado ────────────────────────────────────────────────────────────

describe("middleware — token expirado em rota protegida", () => {
  it("redireciona para /login", () => {
    const res = middleware(req("/", EXPIRED_TOKEN)) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });

  it("apaga o cookie expirado", () => {
    const res = middleware(req("/", EXPIRED_TOKEN)) as any;
    expect(res.cookies.delete).toHaveBeenCalledWith("morabilidade-auth");
  });
});

// ── Token malformado ──────────────────────────────────────────────────────────

describe("middleware — token malformado", () => {
  it("trata token inválido como ausente e redireciona", () => {
    const res = middleware(req("/", "nao.e.um.jwt.valido")) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toContain("/login");
  });

  it("trata string sem pontos como inválida", () => {
    const res = middleware(req("/", "tokenSemPontos")) as any;
    expect(res._action).toBe("redirect");
  });
});

// ── Token válido em rota protegida ────────────────────────────────────────────

describe("middleware — token válido em rota protegida", () => {
  it("deixa passar /", () => {
    middleware(req("/", VALID_TOKEN));
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("deixa passar /imoveis/novo", () => {
    middleware(req("/imoveis/novo", VALID_TOKEN));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });

  it("deixa passar /clientes/123", () => {
    middleware(req("/clientes/123", VALID_TOKEN));
    expect(mocks.next).toHaveBeenCalledTimes(1);
  });
});

// ── Rotas públicas com token válido ───────────────────────────────────────────

describe("middleware — rotas públicas com token válido", () => {
  it("redireciona /login → / quando já autenticado", () => {
    const res = middleware(req("/login", VALID_TOKEN)) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toBe("http://localhost/");
  });

  it("redireciona /recuperar-senha → / quando já autenticado", () => {
    const res = middleware(req("/recuperar-senha", VALID_TOKEN)) as any;
    expect(res._action).toBe("redirect");
    expect(res._url).toBe("http://localhost/");
  });

  it("permite /redefinir-senha mesmo autenticado (link do e-mail)", () => {
    middleware(req("/redefinir-senha", VALID_TOKEN));
    expect(mocks.next).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

// ── Rotas públicas sem token ──────────────────────────────────────────────────

describe("middleware — rotas públicas sem token", () => {
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
