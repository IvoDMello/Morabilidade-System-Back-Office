import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://morabilidade.com.br");

describe("robots()", () => {
  it("aponta o sitemap para a URL correta", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    expect(result.sitemap).toBe("https://morabilidade.com.br/sitemap.xml");
  });

  it("permite rastreamento geral ('/')", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.allow).toContain("/");
  });

  it("bloqueia rastreamento de /api/", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];
    expect(disallow).toContain("/api/");
  });

  it("bloqueia rastreamento de /_next/", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    const disallow = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];
    expect(disallow).toContain("/_next/");
  });

  it("aplica regras para todos os user-agents", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules.userAgent).toBe("*");
  });
});
