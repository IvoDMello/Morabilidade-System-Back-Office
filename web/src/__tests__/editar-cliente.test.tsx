import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: () => ({ id: "cliente-abc" }) };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiGetMock = vi.fn();
const apiPutMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    put: (...args: unknown[]) => apiPutMock(...args),
  },
}));

// Componentes filhos: apenas confirmam que foram renderizados
vi.mock("@/components/clientes/cliente-form", () => ({
  ClienteForm: ({
    onSubmit,
    isLoading,
    submitLabel,
  }: {
    onSubmit: (data: Record<string, unknown>) => void;
    isLoading: boolean;
    submitLabel: string;
  }) => (
    <button
      data-testid="submit-btn"
      onClick={() => onSubmit({ nome_completo: "João", telefone: "11999990000" })}
      disabled={isLoading}
    >
      {isLoading ? "Salvando..." : submitLabel}
    </button>
  ),
}));

vi.mock("@/components/clientes/preferencia-form", () => ({
  PreferenciaForm: () => <div data-testid="preferencia-form" />,
}));

vi.mock("@/components/clientes/matches-cliente", () => ({
  MatchesCliente: () => <div data-testid="matches-cliente" />,
}));

vi.mock("@/components/clientes/cliente-notas", () => ({
  ClienteNotas: () => <div data-testid="cliente-notas" />,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function clienteFixture(overrides = {}) {
  return {
    id: "cliente-abc",
    nome_completo: "João da Silva",
    email: "joao@teste.com",
    telefone: "11999990000",
    cpf_cnpj: null,
    telefone_secundario: null,
    instagram: null,
    endereco: null,
    cidade: null,
    estado: null,
    pais: null,
    origem_lead: null,
    corretor_id: null,
    status: "ativo",
    tipo_cliente: "comprador",
    como_conheceu: null,
    observacoes: null,
    imovel_codigo: null,
    tags: [],
    ...overrides,
  };
}

import EditarClientePage from "@/app/(dashboard)/clientes/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Carregamento ──────────────────────────────────────────────────────────────

describe("EditarClientePage — carregamento", () => {
  it("exibe spinner enquanto carrega", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    expect(screen.getByText(/carregando cliente/i)).toBeInTheDocument();
  });

  it("exibe o formulário após carregar os dados", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(screen.getByTestId("submit-btn")).toBeInTheDocument();
    });
  });

  it("exibe o nome do cliente no cabeçalho", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(screen.getByText(/editar cliente/i)).toBeInTheDocument();
    });
  });

  it("exibe o email do cliente como subtítulo", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture({ email: "joao@teste.com" }) });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(screen.getByText("joao@teste.com")).toBeInTheDocument();
    });
  });

  it("redireciona para /clientes quando cliente não é encontrado", async () => {
    apiGetMock.mockRejectedValue({ response: { status: 404 } });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/clientes");
    });
  });

  it("exibe toast de erro quando cliente não é encontrado", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockRejectedValue({ response: { status: 404 } });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/não encontrado/i));
    });
  });
});

// ── Componentes filhos ────────────────────────────────────────────────────────

describe("EditarClientePage — seções da página", () => {
  it("renderiza seção de preferências", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(screen.getByTestId("preferencia-form")).toBeInTheDocument();
    });
  });

  it("renderiza seção de oportunidades", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(screen.getByTestId("matches-cliente")).toBeInTheDocument();
    });
  });

  it("renderiza seção de notas", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);
    await waitFor(() => {
      expect(screen.getByTestId("cliente-notas")).toBeInTheDocument();
    });
  });
});

// ── Salvar ────────────────────────────────────────────────────────────────────

describe("EditarClientePage — salvar", () => {
  it("chama api.put com o id correto ao submeter", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    apiPutMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        "/clientes/cliente-abc",
        expect.any(Object)
      );
    });
  });

  it("exibe toast de sucesso após salvar", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    apiPutMock.mockResolvedValue({ data: clienteFixture() });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/atualizado/i));
    });
  });

  it("exibe toast de erro quando a API retorna falha", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    apiPutMock.mockRejectedValue({
      response: { data: { detail: "Dados inválidos." } },
    });
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Dados inválidos.");
    });
  });

  it("desabilita o botão durante o salvamento", async () => {
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    apiPutMock.mockImplementation(() => new Promise(() => {}));
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-btn")).toBeDisabled();
    });
  });

  it("exibe mensagem genérica quando erro não tem detalhe", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockResolvedValue({ data: clienteFixture() });
    apiPutMock.mockRejectedValue(new Error("Network Error"));
    render(<EditarClientePage params={Promise.resolve({ id: "cliente-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/erro ao salvar/i));
    });
  });
});
