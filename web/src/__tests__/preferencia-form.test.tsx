import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferenciaForm } from "@/components/clientes/preferencia-form";
import { useAuthStore } from "@/lib/auth-store";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiGetMock = vi.fn();
const apiPutMock = vi.fn();
const apiDeleteMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGetMock(...a),
    put: (...a: unknown[]) => apiPutMock(...a),
    delete: (...a: unknown[]) => apiDeleteMock(...a),
  },
}));

function comoAdmin() {
  useAuthStore.setState({
    user: {
      id: "u1",
      nome_completo: "Admin",
      email: "a@a.com",
      perfil: "admin",
    },
  });
}

const prefExistente = {
  id: "pref-1",
  cliente_id: "cli-1",
  tipo_negocio: "venda",
  ativa: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  comoAdmin();
});

describe("PreferenciaForm — carregamento", () => {
  it("mostra carregando inicialmente", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    render(<PreferenciaForm clienteId="cli-1" />);
    expect(screen.getByText(/carregando preferências/i)).toBeInTheDocument();
  });

  it("trata 404 como preferência em branco (sem botão remover)", async () => {
    apiGetMock.mockRejectedValue({ response: { status: 404 } });
    render(<PreferenciaForm clienteId="cli-1" />);
    await waitFor(() =>
      expect(screen.getByText(/salvar preferência/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/remover preferência/i)).not.toBeInTheDocument();
  });
});

describe("PreferenciaForm — remoção via ConfirmDialog (acessível)", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue({ data: prefExistente });
  });

  it("não dispara delete só por clicar em Remover — abre o diálogo", async () => {
    render(<PreferenciaForm clienteId="cli-1" />);
    await waitFor(() => screen.getByText(/remover preferência/i));

    await userEvent.click(screen.getByRole("button", { name: /remover preferência/i }));

    // Diálogo de confirmação aparece e nada foi deletado ainda.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(apiDeleteMock).not.toHaveBeenCalled();
  });

  it("confirma a remoção e chama a API", async () => {
    apiDeleteMock.mockResolvedValue({});
    render(<PreferenciaForm clienteId="cli-1" />);
    await waitFor(() => screen.getByText(/remover preferência/i));

    await userEvent.click(screen.getByRole("button", { name: /remover preferência/i }));
    await userEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/clientes/cli-1/preferencia")
    );
  });

  it("avisa por toast quando a remoção falha", async () => {
    const { toast } = await import("sonner");
    apiDeleteMock.mockRejectedValue(new Error("falha"));
    render(<PreferenciaForm clienteId="cli-1" />);
    await waitFor(() => screen.getByText(/remover preferência/i));

    await userEvent.click(screen.getByRole("button", { name: /remover preferência/i }));
    await userEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/erro ao remover/i))
    );
  });
});

describe("PreferenciaForm — salvar", () => {
  it("envia o payload normalizado via PUT", async () => {
    apiGetMock.mockResolvedValue({ data: prefExistente });
    apiPutMock.mockResolvedValue({ data: prefExistente });
    render(<PreferenciaForm clienteId="cli-1" />);
    await waitFor(() => screen.getByText(/atualizar/i));

    await userEvent.click(screen.getByRole("button", { name: /atualizar/i }));

    await waitFor(() =>
      expect(apiPutMock).toHaveBeenCalledWith(
        "/clientes/cli-1/preferencia",
        expect.objectContaining({ tipo_negocio: "venda" })
      )
    );
  });
});
