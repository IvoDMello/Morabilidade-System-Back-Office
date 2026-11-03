import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assinarAutorizacao,
  assinarFicha,
  autorizacaoPdfUrl,
  buscarMoraMetrica,
  enviarContato,
  fichaPdfUrl,
  getAutorizacaoPublica,
  getFichaPublica,
  getImovel,
  getImoveisDestaques,
  getMoraMetricaInfo,
  getTags,
  sugerirMoraMetrica,
} from "@/lib/api";

/**
 * Funções públicas do lib/api que o api.test.ts não cobre: assinatura por
 * token, contato e MoraMétrica. O detalhe que importa em cada uma é o que a
 * página recebe quando a API falha.
 */

const mockFetch = vi.fn();
const resposta = (status: number, corpo?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("leituras com fallback vazio", () => {
  it("destaques e tags viram lista vazia quando a API falha", async () => {
    mockFetch.mockResolvedValue(resposta(500));
    expect(await getImoveisDestaques()).toEqual([]);
    expect(await getTags()).toEqual([]);
  });

  it("devolvem o JSON quando dá certo", async () => {
    mockFetch.mockResolvedValue(resposta(200, [{ id: "t1" }]));
    expect(await getTags()).toEqual([{ id: "t1" }]);
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/tags\/publico$/);
  });

  it("502/503/504 tenta de novo uma vez", async () => {
    mockFetch.mockResolvedValueOnce(resposta(503)).mockResolvedValueOnce(resposta(200, [{ codigo: "MB-1" }]));
    expect(await getImoveisDestaques()).toEqual([{ codigo: "MB-1" }]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("getImovel", () => {
  it("codifica o código: '..%2F' decodificado não vira caminho na API", async () => {
    mockFetch.mockResolvedValue(resposta(404));
    await getImovel("../../usuarios");
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/imoveis\/publico\/\.\.%2F\.\.%2Fusuarios$/);
  });
});

describe.each([
  ["ficha de visita", getFichaPublica, assinarFicha, "/fichas-visita/assinar/"],
  ["autorização", getAutorizacaoPublica, assinarAutorizacao, "/autorizacoes/assinar/"],
] as const)("%s por token", (_, ler, assinar, caminho) => {
  it.each([
    [404, "nao_encontrada"],
    [410, "indisponivel"],
    [500, "erro"],
  ])("leitura com HTTP %i lança '%s'", async (status, erro) => {
    mockFetch.mockResolvedValue(resposta(status));
    await expect(ler("tok")).rejects.toThrow(erro);
  });

  it("leitura sem cache e com o token codificado", async () => {
    mockFetch.mockResolvedValue(resposta(200, { status: "pendente" }));
    expect(await ler("a/b")).toEqual({ status: "pendente" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain(`${caminho}a%2Fb`);
    expect(init.cache).toBe("no-store");
  });

  it("assinar manda o corpo e devolve o documento atualizado", async () => {
    mockFetch.mockResolvedValue(resposta(200, { status: "assinada" }));
    const corpo = { aceite: true, cpf: "52998224725", geo: null };
    expect(await assinar("tok", corpo)).toEqual({ status: "assinada" });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(corpo);
  });

  it("erro ao assinar mostra o detalhe da API, ou uma frase padrão", async () => {
    mockFetch.mockResolvedValueOnce(resposta(422, { detail: "CPF inválido." }));
    await expect(assinar("tok", { aceite: true, cpf: "1" })).rejects.toThrow("CPF inválido.");

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => Promise.reject(new Error("html")) });
    await expect(assinar("tok", { aceite: true, cpf: "1" })).rejects.toThrow("Não foi possível assinar.");
  });
});

describe("links de PDF", () => {
  it("codificam o token", () => {
    expect(fichaPdfUrl("a b")).toMatch(/\/fichas-visita\/assinar\/a%20b\/pdf$/);
    expect(autorizacaoPdfUrl("a b")).toMatch(/\/autorizacoes\/assinar\/a%20b\/pdf$/);
  });
});

describe("enviarContato", () => {
  const form = { nome: "Ana", email: "ana@x.com", telefone: "21999990000", mensagem: "Oi" };

  it("posta o formulário", async () => {
    mockFetch.mockResolvedValue(resposta(204));
    await enviarContato(form);
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
  });

  it("erro usa o detalhe da API ou a frase padrão", async () => {
    mockFetch.mockResolvedValueOnce(resposta(429, { detail: "Muitas mensagens." }));
    await expect(enviarContato(form)).rejects.toThrow("Muitas mensagens.");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => Promise.reject(new Error()) });
    await expect(enviarContato(form)).rejects.toThrow("Erro ao enviar mensagem");
  });
});

describe("MoraMétrica", () => {
  it("busca só com os parâmetros preenchidos e lança erro se a API falhar", async () => {
    mockFetch.mockResolvedValueOnce(resposta(200, { tipo: "rua" }));
    expect(await buscarMoraMetrica({ q: "Vieira Souto 510", tipologia: "" })).toEqual({ tipo: "rua" });
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.pathname).toBe("/radar/publico/busca");
    expect([...url.searchParams.keys()]).toEqual(["q"]);

    mockFetch.mockResolvedValue(resposta(500));
    await expect(buscarMoraMetrica({ q: "x" })).rejects.toThrow("MoraMétrica: HTTP 500");
  });

  it("info vira null em erro HTTP ou de rede", async () => {
    mockFetch.mockResolvedValueOnce(resposta(200, { dados_ate: "2026-09-01" }));
    expect(await getMoraMetricaInfo()).toEqual({ dados_ate: "2026-09-01" });
    mockFetch.mockResolvedValue(resposta(500));
    expect(await getMoraMetricaInfo()).toBeNull();
    mockFetch.mockRejectedValue(new TypeError("offline"));
    expect(await getMoraMetricaInfo()).toBeNull();
  });

  it("sugestões codificam o texto e viram lista vazia em erro", async () => {
    mockFetch.mockResolvedValueOnce(resposta(200, [{ rotulo: "Ipanema" }]));
    expect(await sugerirMoraMetrica("são & cia")).toEqual([{ rotulo: "Ipanema" }]);
    expect(mockFetch.mock.calls[0][0]).toContain("q=s%C3%A3o%20%26%20cia");
    mockFetch.mockResolvedValueOnce(resposta(500));
    expect(await sugerirMoraMetrica("x")).toEqual([]);
  });
});
