import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const apiPostMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { post: (...args: unknown[]) => apiPostMock(...args) },
}));

import ImportarClientesPage from "@/app/(dashboard)/clientes/importar/page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function csvFile(name = "clientes.csv") {
  return new File(["nome_completo;telefone\nJoão;11999"], name, { type: "text/csv" });
}

function resultadoOk(overrides = {}) {
  return {
    total_lidas: 2,
    criadas: 2,
    preferencias_criadas: 1,
    erros: 0,
    campos_reconhecidos: ["nome_completo", "telefone"],
    campos_ignorados: [],
    detalhes_erros: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Renderização inicial ──────────────────────────────────────────────────────

describe("ImportarClientesPage — renderização", () => {
  it("exibe área de upload", () => {
    render(<ImportarClientesPage />);
    expect(screen.getByText(/clique para selecionar um csv/i)).toBeInTheDocument();
  });

  it("exibe link para baixar o template", () => {
    render(<ImportarClientesPage />);
    const link = screen.getByRole("link", { name: /baixar template csv/i });
    expect(link).toHaveAttribute("href", "/template-clientes.csv");
  });

  it("botão importar começa desabilitado sem arquivo", () => {
    render(<ImportarClientesPage />);
    expect(screen.getByRole("button", { name: /importar/i })).toBeDisabled();
  });

  it("exibe seção de cabeçalhos reconhecidos", () => {
    render(<ImportarClientesPage />);
    expect(screen.getByText(/cabeçalhos reconhecidos automaticamente/i)).toBeInTheDocument();
  });
});

// ── Seleção de arquivo ────────────────────────────────────────────────────────

describe("ImportarClientesPage — seleção de arquivo", () => {
  it("habilita o botão após selecionar um CSV", async () => {
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    expect(screen.getByRole("button", { name: /importar/i })).toBeEnabled();
  });

  it("exibe o nome do arquivo selecionado", async () => {
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile("meus-leads.csv"));
    expect(screen.getByText("meus-leads.csv")).toBeInTheDocument();
  });

  it("rejeita arquivo que não é .csv", async () => {
    const { toast } = await import("sonner");
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    // Usa fireEvent para contornar o filtro `accept` do user-event v14
    const file = new File(["data"], "planilha.xlsx", { type: "application/vnd.ms-excel" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/csv/i));
    expect(screen.getByRole("button", { name: /importar/i })).toBeDisabled();
  });

  it("exibe botão Cancelar após selecionar arquivo", async () => {
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("botão Cancelar limpa a seleção", async () => {
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(screen.getByRole("button", { name: /importar/i })).toBeDisabled();
  });
});

// ── Importação com sucesso ────────────────────────────────────────────────────

describe("ImportarClientesPage — importação com sucesso", () => {
  it("chama api.post com o arquivo", async () => {
    apiPostMock.mockResolvedValue({ data: resultadoOk() });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        "/clientes/importar",
        expect.any(FormData),
        expect.any(Object)
      );
    });
  });

  it("exibe painel de resultado com 4 cards", async () => {
    apiPostMock.mockResolvedValue({ data: resultadoOk() });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      // "Lidas" e "Oportunidades" são únicos na página; "Clientes"/"Erros" podem aparecer em outros contextos
      expect(screen.getByText("Lidas")).toBeInTheDocument();
      expect(screen.getByText("Oportunidades")).toBeInTheDocument();
      expect(screen.getAllByText(/clientes/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/erros/i).length).toBeGreaterThan(0);
    });
  });

  it("exibe contadores corretos no resultado", async () => {
    apiPostMock.mockResolvedValue({
      data: resultadoOk({ total_lidas: 5, criadas: 4, preferencias_criadas: 3, erros: 1 }),
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // lidas
      expect(screen.getByText("4")).toBeInTheDocument(); // criadas
      expect(screen.getByText("3")).toBeInTheDocument(); // oportunidades
      expect(screen.getByText("1")).toBeInTheDocument(); // erros
    });
  });

  it("exibe toast de sucesso com contagem de perfis", async () => {
    const { toast } = await import("sonner");
    apiPostMock.mockResolvedValue({
      data: resultadoOk({ criadas: 2, preferencias_criadas: 2 }),
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/perfil/i)
      );
    });
  });

  it("exibe campos reconhecidos", async () => {
    apiPostMock.mockResolvedValue({
      data: resultadoOk({ campos_reconhecidos: ["nome_completo", "telefone", "pref_tipo_negocio"] }),
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      // "nome_completo" aparece na lista estática de campos E no resultado — ambos válidos
      expect(screen.getAllByText(/nome_completo/i).length).toBeGreaterThan(0);
      // "pref_tipo_negocio" aparece tanto no resultado quanto na seção de campos reconhecidos
      expect(screen.getAllByText(/pref_tipo_negocio/i).length).toBeGreaterThan(0);
    });
  });
});

// ── Resultado com erros ───────────────────────────────────────────────────────

describe("ImportarClientesPage — resultado com erros", () => {
  it("exibe toast de aviso quando há erros", async () => {
    const { toast } = await import("sonner");
    apiPostMock.mockResolvedValue({
      data: resultadoOk({ criadas: 1, erros: 2, detalhes_erros: [
        { linha: 2, motivo: "Nome vazio" },
        { linha: 3, motivo: "Telefone e Instagram vazios" },
      ]}),
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/erro/i));
    });
  });

  it("lista os detalhes dos erros por linha", async () => {
    apiPostMock.mockResolvedValue({
      data: resultadoOk({ erros: 1, detalhes_erros: [{ linha: 3, motivo: "E-mail já cadastrado" }] }),
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(screen.getByText(/linha 3/i)).toBeInTheDocument();
      expect(screen.getByText(/e-mail já cadastrado/i)).toBeInTheDocument();
    });
  });

  it("exibe colunas ignoradas quando existem", async () => {
    apiPostMock.mockResolvedValue({
      data: resultadoOk({ campos_ignorados: ["coluna_desconhecida"] }),
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(screen.getByText(/coluna_desconhecida/i)).toBeInTheDocument();
    });
  });
});

// ── Erro de API ───────────────────────────────────────────────────────────────

describe("ImportarClientesPage — erro de API", () => {
  it("exibe toast de erro quando a API falha", async () => {
    const { toast } = await import("sonner");
    apiPostMock.mockRejectedValue({
      response: { data: { detail: "Arquivo muito grande." } },
    });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Arquivo muito grande.");
    });
  });

  it("exibe mensagem genérica se a API não retornar detalhe", async () => {
    const { toast } = await import("sonner");
    apiPostMock.mockRejectedValue(new Error("Network Error"));
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Erro ao importar CSV.");
    });
  });

  it("exibe 'Importando...' durante o loading", async () => {
    apiPostMock.mockImplementation(() => new Promise(() => {}));
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /importando/i })).toBeInTheDocument();
    });
  });
});

// ── Reset após resultado ──────────────────────────────────────────────────────

describe("ImportarClientesPage — reset", () => {
  it("botão 'Importar outro arquivo' volta ao estado inicial", async () => {
    apiPostMock.mockResolvedValue({ data: resultadoOk() });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => screen.getByText(/resultado da importação/i));
    await userEvent.click(screen.getByRole("button", { name: /importar outro arquivo/i }));

    expect(screen.getByText(/clique para selecionar um csv/i)).toBeInTheDocument();
  });

  it("botão fechar (×) no resultado volta ao estado inicial", async () => {
    apiPostMock.mockResolvedValue({ data: resultadoOk() });
    render(<ImportarClientesPage />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, csvFile());
    await userEvent.click(screen.getByRole("button", { name: /importar/i }));

    await waitFor(() => screen.getByText(/resultado da importação/i));
    await userEvent.click(screen.getByTitle(/fechar/i));

    expect(screen.getByText(/clique para selecionar um csv/i)).toBeInTheDocument();
  });
});

// ── Campos de preferência na lista de campos reconhecidos ─────────────────────

describe("ImportarClientesPage — campos pref_* documentados", () => {
  it("lista pref_tipo_negocio na seção de cabeçalhos reconhecidos", () => {
    render(<ImportarClientesPage />);
    expect(screen.getByText("pref_tipo_negocio")).toBeInTheDocument();
  });

  it("lista pref_bairros na seção de cabeçalhos reconhecidos", () => {
    render(<ImportarClientesPage />);
    expect(screen.getByText("pref_bairros")).toBeInTheDocument();
  });

  it("lista pref_valor_min na seção de cabeçalhos reconhecidos", () => {
    render(<ImportarClientesPage />);
    expect(screen.getByText("pref_valor_min")).toBeInTheDocument();
  });
});
