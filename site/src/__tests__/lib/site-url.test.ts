import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SITE_URL", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("usa o .com como padrão quando a env não está definida", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { SITE_URL } = await import("@/lib/site-url");
    expect(SITE_URL).toBe("https://morabilidade.com");
  });

  it("converte o domínio .com.br legado para .com", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://morabilidade.com.br");
    const { SITE_URL } = await import("@/lib/site-url");
    expect(SITE_URL).toBe("https://morabilidade.com");
  });

  it("converte também com www e barra final", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.morabilidade.com.br/");
    const { SITE_URL } = await import("@/lib/site-url");
    expect(SITE_URL).toBe("https://www.morabilidade.com");
  });

  it("mantém a env quando já é .com", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://morabilidade.com");
    const { SITE_URL } = await import("@/lib/site-url");
    expect(SITE_URL).toBe("https://morabilidade.com");
  });

  it("mantém localhost no desenvolvimento", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3001");
    const { SITE_URL } = await import("@/lib/site-url");
    expect(SITE_URL).toBe("http://localhost:3001");
  });
});
