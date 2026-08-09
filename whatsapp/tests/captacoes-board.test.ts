import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkNovaCaptacao, rascunhoDaProposta } from "@/lib/captacao-link";

/**
 * O CRM não cria mais captação: ele monta um rascunho e abre o formulário
 * completo do board, onde o cartão nasce com os campos obrigatórios e passa
 * pela checagem de duplicadas. O que este arquivo trava é a ponta de cá —
 * o link certo, e a leitura do board continuando a funcionar sem credencial.
 */

describe("Link de hand-off para o board", () => {
  it("leva o rascunho na query string, no formato que o board lê", () => {
    const href = linkNovaCaptacao("https://captacoes.morabilidade.com", {
      endereco: "Rua Albert Sabin, 10",
      quartos: 5,
      banheiros: 3,
      tipo_portaria: "casa",
      proprietario_nome: "Fernanda Lima",
      whatsapp: "5511991234567",
      observacoes: "teste",
    });

    const url = new URL(href!);
    expect(url.origin + url.pathname).toBe("https://captacoes.morabilidade.com/board");
    // `nova=1` é o que faz o board abrir o formulário sozinho.
    expect(url.searchParams.get("nova")).toBe("1");
    expect(url.searchParams.get("endereco")).toBe("Rua Albert Sabin, 10");
    expect(url.searchParams.get("quartos")).toBe("5");
    expect(url.searchParams.get("proprietario_nome")).toBe("Fernanda Lima");
    expect(url.searchParams.get("whatsapp")).toBe("5511991234567");
  });

  it("campo vazio não vira parâmetro (não sobrescreve o board com string vazia)", () => {
    const href = linkNovaCaptacao("https://captacoes.morabilidade.com", {
      endereco: "Rua X, 1",
      quartos: "",
      tipo_portaria: "   ",
      observacoes: null,
    });

    const url = new URL(href!);
    expect(url.searchParams.has("quartos")).toBe(false);
    expect(url.searchParams.has("tipo_portaria")).toBe(false);
    expect(url.searchParams.has("observacoes")).toBe(false);
  });

  it("barra sobrando na URL do board não vira barra dupla", () => {
    const href = linkNovaCaptacao("https://captacoes.morabilidade.com/", { endereco: "Rua X, 1" });
    expect(href).toContain("https://captacoes.morabilidade.com/board?");
  });

  it("sem board configurado não há para onde mandar", () => {
    expect(linkNovaCaptacao(null, { endereco: "Rua X, 1" })).toBeNull();
  });

  it("proposta da IA vira rascunho, inclusive as antigas de campo único", () => {
    expect(
      rascunhoDaProposta({ endereco: "Rua X, 1", proprietario_nome: "Ana", proprietario_whatsapp: "5511999999999" }),
    ).toMatchObject({ proprietario_nome: "Ana", whatsapp: "5511999999999" });

    // Proposta gravada antes de o board separar nome e WhatsApp.
    expect(rascunhoDaProposta({ endereco: "Rua X, 1", contato_proprietario: "Ana (11) 99999-9999" })).toMatchObject(
      { proprietario_nome: "Ana (11) 99999-9999" },
    );
  });
});

describe("Leitura do board", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "mock");
    // O que faltava no ambiente onde o "supabaseKey is required" apareceu.
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("em modo mock, lista sem exigir credencial nenhuma", async () => {
    vi.resetModules();
    const { mockStore } = await import("@/services/data/mock/store");
    const { listCaptacoesDoTelefone, listCaptacoesRecentes } = await import(
      "@/services/captacoes.service"
    );

    mockStore.captacoes.length = 0;
    mockStore.captacoes.push({
      id: "cap-1",
      status: "novas",
      statusLabel: "Novas",
      endereco: "Rua Albert Sabin, 10",
      quartos: 5,
      banheiros: 3,
      tipoPortaria: "casa",
      proprietarioNome: "Fernanda Lima",
      proprietarioWhatsapp: "5511991234567",
      observacoes: null,
      criadoEm: "2026-08-04T12:00:00Z",
      atualizadoEm: "2026-08-04T12:00:00Z",
    });

    expect(await listCaptacoesRecentes()).toHaveLength(1);
    // Casa por DDI diferente (o board grava mascarado, o CRM com 55).
    expect(await listCaptacoesDoTelefone("11991234567")).toHaveLength(1);
    // Telefone de outro contato não puxa captação alheia.
    expect(await listCaptacoesDoTelefone("5511955443322")).toEqual([]);
  });

  it("sem a service_role key, o erro diz qual variável falta e onde achá-la", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "supabase");
    vi.resetModules();
    const { listCaptacoesRecentes } = await import("@/services/captacoes.service");

    await expect(listCaptacoesRecentes()).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY.*\.env\.local/,
    );
  });
});
