import { describe, it, expect, vi, beforeEach } from "vitest";

// Deve rodar antes do import do módulo para que process.env seja injetado
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://morabilidade.com.br");
vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");

const mockImoveis = [
  { codigo: "MOR-001", created_at: "2024-01-15T10:00:00Z" },
  { codigo: "MOR-002", created_at: "2024-02-20T10:00:00Z" },
];

describe("sitemap()", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("inclui as páginas estáticas", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockImoveis,
    } as Response);

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://morabilidade.com.br");
    expect(urls).toContain("https://morabilidade.com.br/imoveis");
    expect(urls).toContain("https://morabilidade.com.br/sobre");
    expect(urls).toContain("https://morabilidade.com.br/contato");
  });

  it("inclui as URLs dos imóveis disponíveis", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockImoveis,
    } as Response);

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://morabilidade.com.br/imoveis/MOR-001");
    expect(urls).toContain("https://morabilidade.com.br/imoveis/MOR-002");
  });

  it("define prioridade 1.0 para a homepage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const homepage = entries.find((e) => e.url === "https://morabilidade.com.br");

    expect(homepage?.priority).toBe(1.0);
  });

  it("define prioridade 0.8 para páginas de imóvel", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockImoveis,
    } as Response);

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const imovelEntry = entries.find((e) => e.url.includes("/imoveis/MOR-001"));

    expect(imovelEntry?.priority).toBe(0.8);
  });

  it("retorna apenas páginas estáticas quando a API falha", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("API offline"));

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://morabilidade.com.br");
    expect(urls.some((u) => u.includes("/imoveis/MOR"))).toBe(false);
  });

  it("retorna apenas páginas estáticas quando a API retorna erro HTTP", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();

    expect(entries).toHaveLength(4); // apenas as páginas estáticas
  });

  it("consome o endpoint correto de imóveis disponíveis", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    global.fetch = fetchMock;

    const { default: sitemap } = await import("@/app/sitemap");
    await sitemap();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/imoveis/publico/disponiveis"),
      expect.any(Object)
    );
  });
});
