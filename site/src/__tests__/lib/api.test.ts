import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBairros, getImoveisDisponiveis, getImovel } from "@/lib/api";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => vi.unstubAllGlobals());

// ── getBairros ────────────────────────────────────────────────────────────────

describe("getBairros", () => {
  it("retorna lista de bairros em caso de sucesso", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ["Jardins", "Moema", "Pinheiros"],
    });
    const result = await getBairros();
    expect(result).toEqual(["Jardins", "Moema", "Pinheiros"]);
  });

  it("retorna lista vazia quando a resposta não é ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await getBairros();
    expect(result).toEqual([]);
  });

  it("propaga o erro quando as duas tentativas de rede falham", async () => {
    // fetchGetWithRetry retenta uma vez em erro de rede; se ambas falharem,
    // o erro sobe para o chamador (Server Component) tratar.
    mockFetch.mockRejectedValue(new Error("Network error"));
    await expect(getBairros()).rejects.toThrow("Network error");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("recupera no retry quando a primeira tentativa falha", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ ok: true, json: async () => ["Jardins"] });
    const result = await getBairros();
    expect(result).toEqual(["Jardins"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("chama o endpoint /imoveis/publico/bairros", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await getBairros();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/imoveis/publico/bairros");
  });

  it("usa revalidate de 1 dia para cache (bairros mudam ~nunca)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await getBairros();
    const [, options] = mockFetch.mock.calls[0];
    expect(options?.next?.revalidate).toBe(86400);
  });

  it("retorna lista vazia para array vazio da API", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    const result = await getBairros();
    expect(result).toEqual([]);
  });
});

// ── getImoveisDisponiveis ─────────────────────────────────────────────────────

describe("getImoveisDisponiveis", () => {
  const mockImovel = {
    id: "1",
    codigo: "MB-00001",
    tipo_negocio: "venda",
    disponibilidade: "disponivel",
    cidade: "São Paulo",
    bairro: "Pinheiros",
    tipo_imovel: "apartamento",
    valor_venda: 650000,
    foto_capa: null,
    tags: [],
  };

  it("retorna data e total em caso de sucesso", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockImovel],
      headers: { get: (h: string) => (h === "x-total-count" ? "1" : null) },
    });
    const result = await getImoveisDisponiveis();
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("usa x-total-count do header quando disponível", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockImovel],
      headers: { get: (h: string) => (h === "x-total-count" ? "42" : null) },
    });
    const result = await getImoveisDisponiveis();
    expect(result.total).toBe(42);
  });

  it("usa length da resposta quando header ausente", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockImovel],
      headers: { get: () => null },
    });
    const result = await getImoveisDisponiveis();
    expect(result.total).toBe(1);
  });

  it("inclui parâmetro ordenar na URL quando fornecido", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
      headers: { get: () => "0" },
    });
    await getImoveisDisponiveis({ ordenar: "preco_asc" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("ordenar=preco_asc");
  });

  it("lança erro quando a resposta não é ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(getImoveisDisponiveis()).rejects.toThrow("Erro ao buscar imóveis");
  });

  it("não inclui parâmetros vazios na URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
      headers: { get: () => "0" },
    });
    await getImoveisDisponiveis({ cidade: "", bairro: "" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("cidade=");
    expect(url).not.toContain("bairro=");
  });
});

// ── getImovel ─────────────────────────────────────────────────────────────────

describe("getImovel", () => {
  it("retorna null para imóvel não encontrado (404)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await getImovel("MB-99999");
    expect(result).toBeNull();
  });

  it("lança erro para outros status de falha", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(getImovel("MB-00001")).rejects.toThrow("Erro ao buscar imóvel");
  });

  it("retorna dados do imóvel em caso de sucesso", async () => {
    const imovelDetalhado = { id: "1", codigo: "MB-00001", fotos: [], tags: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => imovelDetalhado,
    });
    const result = await getImovel("MB-00001");
    expect(result?.codigo).toBe("MB-00001");
  });

  it("chama o endpoint correto com o codigo", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", codigo: "MB-00001" }),
    });
    await getImovel("MB-00001");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/imoveis/publico/MB-00001");
  });
});
