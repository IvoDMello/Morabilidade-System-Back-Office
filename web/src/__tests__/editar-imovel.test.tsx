import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: () => ({ id: "imovel-abc" }) };
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
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: (err: unknown, fallback = "Ocorreu um erro.") => {
    const d = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    if (typeof d === "string" && d.trim()) return d;
    if (Array.isArray(d) && d.length > 0) {
      return d
        .map((x) => (typeof x === "string" ? x : (x as { msg?: string })?.msg ?? "Erro de validação"))
        .join("; ");
    }
    return fallback;
  },
}));

vi.mock("react-dropzone", () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

// Componentes filhos
vi.mock("@/components/imoveis/imovel-form", () => ({
  ImovelForm: ({
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
      onClick={() => onSubmit({ codigo: "MOB001", tipo_negocio: "venda" })}
      disabled={isLoading}
    >
      {isLoading ? "Salvando..." : submitLabel}
    </button>
  ),
}));

vi.mock("@/components/imoveis/interessados-imovel", () => ({
  InteressadosImovel: () => <div data-testid="interessados-imovel" />,
}));

vi.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function imovelFixture(overrides = {}) {
  return {
    id: "imovel-abc",
    codigo: "MOB001",
    tipo_negocio: "venda",
    disponibilidade: "disponivel",
    condicao: "novo",
    cep: "01310-100",
    logradouro: "Av. Paulista",
    numero: "1000",
    complemento: null,
    bairro: "Bela Vista",
    cidade: "São Paulo",
    tipo_imovel: "apartamento",
    dormitorios: 2,
    suites: 1,
    banheiros: 2,
    vagas_garagem: 1,
    mobiliado: null,
    andar: null,
    area_total: null,
    area_util: 80,
    valor_venda: 500000,
    valor_locacao: null,
    iptu_mensal: null,
    condominio_mensal: null,
    descricao: "",
    video_url: "",
    corretor_id: null,
    destaque_ordem: null,
    tags: [],
    imovel_fotos: [],
    ...overrides,
  };
}

import EditarImovelPage from "@/app/(dashboard)/imoveis/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Carregamento ──────────────────────────────────────────────────────────────

describe("EditarImovelPage — carregamento", () => {
  it("exibe spinner enquanto carrega", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    expect(screen.getByText(/carregando imóvel/i)).toBeInTheDocument();
  });

  it("exibe o formulário após carregar os dados", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(screen.getByTestId("submit-btn")).toBeInTheDocument();
    });
  });

  it("exibe o código do imóvel no cabeçalho", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture({ codigo: "MOB001" }) });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(screen.getByText("MOB001")).toBeInTheDocument();
    });
  });

  it("exibe o endereço no subtítulo", async () => {
    apiGetMock.mockResolvedValue({
      data: imovelFixture({ logradouro: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo" }),
    });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(screen.getByText(/av\. paulista/i)).toBeInTheDocument();
    });
  });

  it("redireciona para /imoveis quando imóvel não é encontrado", async () => {
    apiGetMock.mockRejectedValue({ response: { status: 404 } });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/imoveis");
    });
  });

  it("exibe toast de erro quando imóvel não é encontrado", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockRejectedValue({ response: { status: 404 } });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/não encontrado/i));
    });
  });
});

// ── Galeria de fotos ──────────────────────────────────────────────────────────

describe("EditarImovelPage — galeria de fotos", () => {
  it("exibe mensagem quando não há fotos", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture({ imovel_fotos: [] }) });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(screen.getByText(/nenhuma foto cadastrada/i)).toBeInTheDocument();
    });
  });

  it("exibe contagem de fotos", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture({ imovel_fotos: [] }) });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(screen.getByText("0/30")).toBeInTheDocument();
    });
  });
});

// ── Seção de interessados ─────────────────────────────────────────────────────

describe("EditarImovelPage — interessados", () => {
  it("renderiza seção de interessados", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);
    await waitFor(() => {
      expect(screen.getByTestId("interessados-imovel")).toBeInTheDocument();
    });
  });
});

// ── Salvar ────────────────────────────────────────────────────────────────────

describe("EditarImovelPage — salvar", () => {
  it("chama api.put com o id correto ao submeter", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    apiPutMock.mockResolvedValue({ data: imovelFixture() });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        "/imoveis/imovel-abc",
        expect.any(Object)
      );
    });
  });

  it("exibe toast de sucesso após salvar", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    apiPutMock.mockResolvedValue({ data: imovelFixture() });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/atualizado/i));
    });
  });

  it("exibe toast de erro quando a API retorna falha", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    apiPutMock.mockRejectedValue({
      response: { data: { detail: "Código já utilizado." } },
    });
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Código já utilizado.");
    });
  });

  it("desabilita o botão durante o salvamento", async () => {
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    apiPutMock.mockImplementation(() => new Promise(() => {}));
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-btn")).toBeDisabled();
    });
  });

  it("exibe mensagem genérica quando erro não tem detalhe", async () => {
    const { toast } = await import("sonner");
    apiGetMock.mockResolvedValue({ data: imovelFixture() });
    apiPutMock.mockRejectedValue(new Error("Network Error"));
    render(<EditarImovelPage params={Promise.resolve({ id: "imovel-abc" })} />);

    await waitFor(() => screen.getByTestId("submit-btn"));
    await userEvent.click(screen.getByTestId("submit-btn"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/erro ao salvar/i));
    });
  });
});
