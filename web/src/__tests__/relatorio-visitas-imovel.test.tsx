import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FichasImovel } from "@/components/fichas/fichas-imovel";

const apiGetMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (seletor: (s: unknown) => unknown) =>
    seletor({ user: { id: "u1", perfil: "admin", nome_completo: "Admin" } }),
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastErrorMock(...a) },
}));

function ficha(overrides = {}) {
  return {
    id: "f1",
    visitante_nome: "Ana Clara de Souza Lima",
    visitante_telefone: "21997729990",
    status: "assinada",
    token: "tok",
    assinada_em: "2026-08-20T17:30:00+00:00",
    created_at: "2026-08-19T10:00:00+00:00",
    ...overrides,
  };
}

/** Responde a lista de fichas do imóvel; os demais GETs voltam vazios. */
function mockFichas(fichas: unknown[]) {
  apiGetMock.mockImplementation((url: string) => {
    if (url.startsWith("/fichas-visita")) return Promise.resolve({ data: fichas });
    return Promise.resolve({ data: [] });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // O download cria um object URL; jsdom não implementa nenhum dos dois.
  window.URL.createObjectURL = vi.fn(() => "blob:fake");
  window.URL.revokeObjectURL = vi.fn();
});

describe("Relatório de visitas do imóvel", () => {
  it("baixa o PDF do relatório com o código do imóvel no nome do arquivo", async () => {
    mockFichas([ficha()]);
    render(<FichasImovel imovelId="imo-1" imovelCodigo="MOR-1042" />);

    const botao = await screen.findByRole("button", { name: /relatório de visitas/i });
    await waitFor(() => expect(botao).toBeEnabled());

    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    apiGetMock.mockResolvedValueOnce({ data: new Blob(["%PDF-"]) });
    await userEvent.click(botao);

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("/imoveis/imo-1/relatorio-visitas", {
        responseType: "blob",
      }),
    );
    expect(clique).toHaveBeenCalled();
    clique.mockRestore();
  });

  it("fica desabilitado enquanto nenhuma ficha foi assinada", async () => {
    mockFichas([ficha({ status: "pendente", assinada_em: null })]);
    render(<FichasImovel imovelId="imo-1" imovelCodigo="MOR-1042" />);

    const botao = await screen.findByRole("button", { name: /relatório de visitas/i });
    await waitFor(() => expect(botao).toBeDisabled());
  });

  it("avisa quando a geração do relatório falha", async () => {
    mockFichas([ficha()]);
    render(<FichasImovel imovelId="imo-1" imovelCodigo="MOR-1042" />);

    const botao = await screen.findByRole("button", { name: /relatório de visitas/i });
    await waitFor(() => expect(botao).toBeEnabled());

    apiGetMock.mockRejectedValueOnce(new Error("502"));
    await userEvent.click(botao);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Erro ao gerar o relatório de visitas."),
    );
  });
});
