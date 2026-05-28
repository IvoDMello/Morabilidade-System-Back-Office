import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReajustesLocacao } from "@/components/locacoes/reajustes-locacao";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

let currentUserPerfil: "admin" | "corretor" = "admin";
vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (s: { user: { perfil: string } }) => unknown) =>
    selector({ user: { perfil: currentUserPerfil } }),
}));

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  currentUserPerfil = "admin";
});

const REAJUSTE = {
  id: "r1",
  contrato_id: "c1",
  data_aplicacao: "2027-01-01",
  percentual: "4.25",
  aluguel_anterior: "8500.00",
  aluguel_novo: "8861.25",
  indice_referencia: "IGPM",
  observacoes: null,
  applied_by: null,
  created_at: "2026-12-30T00:00:00+00:00",
};

describe("ReajustesLocacao", () => {
  it("lista reajustes existentes", async () => {
    apiGet.mockResolvedValue({ data: [REAJUSTE] });
    render(<ReajustesLocacao contratoId="c1" aluguelAtual={8861.25} />);
    await waitFor(() => expect(screen.getByText(/IGPM/)).toBeInTheDocument());
    expect(screen.getByText(/\+4\.25%/)).toBeInTheDocument();
  });

  it("estado vazio sem reajustes", async () => {
    apiGet.mockResolvedValue({ data: [] });
    render(<ReajustesLocacao contratoId="c1" aluguelAtual={8500} />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum reajuste aplicado/)).toBeInTheDocument()
    );
  });

  it("corretor vê botão de aplicar (mesmas permissões do admin)", async () => {
    currentUserPerfil = "corretor";
    apiGet.mockResolvedValue({ data: [] });
    render(<ReajustesLocacao contratoId="c1" aluguelAtual={8500} />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhum reajuste/)).toBeInTheDocument()
    );
    expect(screen.getByText("Aplicar reajuste")).toBeInTheDocument();
  });

  it("preview do novo aluguel reage ao percentual digitado", async () => {
    apiGet.mockResolvedValue({ data: [] });
    render(<ReajustesLocacao contratoId="c1" aluguelAtual={8500} />);
    await waitFor(() =>
      expect(screen.getByText("Aplicar reajuste")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("Aplicar reajuste"));

    const pctInput = screen.getByPlaceholderText(/Ex: 4.25/);
    await userEvent.type(pctInput, "10");
    // 8500 + 10% = 9350
    expect(screen.getByText(/R\$\s*9\.350,00/)).toBeInTheDocument();
  });

  it("aplica reajuste e chama onAplicado", async () => {
    apiGet.mockResolvedValueOnce({ data: [] });
    apiPost.mockResolvedValue({});
    apiGet.mockResolvedValueOnce({ data: [REAJUSTE] });

    const onAplicado = vi.fn();
    render(
      <ReajustesLocacao contratoId="c1" aluguelAtual={8500} onAplicado={onAplicado} />
    );
    await waitFor(() =>
      expect(screen.getByText("Aplicar reajuste")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("Aplicar reajuste"));
    await userEvent.type(screen.getByPlaceholderText(/Ex: 4.25/), "4.25");
    await userEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/locacoes/c1/reajustar",
        expect.objectContaining({
          percentual: 4.25,
          indice_referencia: "IGPM",
        })
      );
      expect(onAplicado).toHaveBeenCalled();
    });
  });

  it("exibe mensagem de erro do backend quando reajuste invalidado", async () => {
    apiGet.mockResolvedValue({ data: [] });
    const { toast } = await import("sonner");
    apiPost.mockRejectedValueOnce({
      response: { data: { detail: "Reajuste resultaria em aluguel zero ou negativo — revise o percentual." } },
    });

    render(<ReajustesLocacao contratoId="c1" aluguelAtual={8500} />);
    await waitFor(() =>
      expect(screen.getByText("Aplicar reajuste")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByText("Aplicar reajuste"));
    await userEvent.type(screen.getByPlaceholderText(/Ex: 4.25/), "-100");
    await userEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("aluguel zero ou negativo")
      )
    );
  });
});
