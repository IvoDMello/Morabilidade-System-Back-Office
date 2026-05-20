import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LocacaoForm } from "@/components/locacoes/locacao-form";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const IMOVEIS = [
  {
    id: "imo-1",
    codigo: "MB-001",
    logradouro: "Rua A",
    numero: "10",
    bairro: "Centro",
    cidade: "Rio",
  },
];

const CLIENTES = [
  { id: "prop-1", nome_completo: "Pedro Proprietário", tipo_cliente: "proprietario" },
  { id: "loc-1", nome_completo: "Maria Locatária", tipo_cliente: "locatario" },
];

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((url: string) => {
    if (url === "/imoveis/") return Promise.resolve({ data: IMOVEIS });
    if (url === "/clientes/") return Promise.resolve({ data: CLIENTES });
    return Promise.resolve({ data: [] });
  });
});

// O Field do componente não usa htmlFor; consultamos por name (react-hook-form).
function byName<T extends HTMLElement = HTMLInputElement>(container: HTMLElement, name: string) {
  const el = container.querySelector<T>(`[name="${name}"]`);
  if (!el) throw new Error(`elemento name="${name}" não encontrado`);
  return el;
}

async function preencherMinimo(container: HTMLElement) {
  await waitFor(() =>
    expect(screen.getByRole("option", { name: /MB-001/ })).toBeInTheDocument()
  );
  await userEvent.selectOptions(byName<HTMLSelectElement>(container, "imovel_id"), "imo-1");
  await userEvent.selectOptions(byName<HTMLSelectElement>(container, "proprietario_id"), "prop-1");
  await userEvent.selectOptions(byName<HTMLSelectElement>(container, "locatario_id"), "loc-1");
  await userEvent.type(byName(container, "data_inicio"), "2026-01-01");
  await userEvent.type(byName(container, "data_fim"), "2027-12-31");
  await userEvent.type(byName(container, "aluguel_mensal"), "5000");
}

describe("LocacaoForm", () => {
  it("renderiza imóveis e clientes carregados via API", async () => {
    render(<LocacaoForm onSubmit={vi.fn()} />);
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/imoveis/", { params: { page_size: 100 } });
      expect(apiGet).toHaveBeenCalledWith("/clientes/", { params: { page_size: 100 } });
    });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /MB-001/ })).toBeInTheDocument()
    );
  });

  it("submit válido envia dados convertidos", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<LocacaoForm onSubmit={onSubmit} submitLabel="Criar" />);

    await preencherMinimo(container);
    await userEvent.click(screen.getAllByRole("button", { name: "Criar" })[0]);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const data = onSubmit.mock.calls[0][0];
    expect(data).toMatchObject({
      imovel_id: "imo-1",
      proprietario_id: "prop-1",
      locatario_id: "loc-1",
      data_inicio: "2026-01-01",
      data_fim: "2027-12-31",
      aluguel_mensal: 5000,
      dia_vencimento: 5,
      taxa_administracao_pct: 0,
    });
  });

  it("bloqueia data_fim anterior a data_inicio", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<LocacaoForm onSubmit={onSubmit} />);

    await preencherMinimo(container);
    const dataFim = byName(container, "data_fim");
    await userEvent.clear(dataFim);
    await userEvent.type(dataFim, "2025-01-01");

    await userEvent.click(screen.getAllByRole("button", { name: "Salvar" })[0]);
    expect(await screen.findByText(/Fim deve ser depois do início/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bloqueia proprietário igual ao locatário", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<LocacaoForm onSubmit={onSubmit} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /MB-001/ })).toBeInTheDocument()
    );

    await userEvent.selectOptions(byName<HTMLSelectElement>(container, "imovel_id"), "imo-1");
    await userEvent.selectOptions(byName<HTMLSelectElement>(container, "proprietario_id"), "prop-1");
    await userEvent.selectOptions(byName<HTMLSelectElement>(container, "locatario_id"), "prop-1");
    await userEvent.type(byName(container, "data_inicio"), "2026-01-01");
    await userEvent.type(byName(container, "data_fim"), "2027-12-31");
    await userEvent.type(byName(container, "aluguel_mensal"), "5000");

    await userEvent.click(screen.getAllByRole("button", { name: "Salvar" })[0]);
    expect(
      await screen.findByText(/Proprietário e locatário devem ser pessoas diferentes/)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("bloqueia taxa de administração > 100", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<LocacaoForm onSubmit={onSubmit} />);

    await preencherMinimo(container);
    await userEvent.type(byName(container, "taxa_administracao_pct"), "150");
    await userEvent.click(screen.getAllByRole("button", { name: "Salvar" })[0]);

    // zod bloqueia — onSubmit nunca é chamado.
    await new Promise((r) => setTimeout(r, 100));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preview do total replica a fórmula do backend (aluguel − fundo reserva)", async () => {
    const { container } = render(<LocacaoForm onSubmit={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /MB-001/ })).toBeInTheDocument()
    );

    await userEvent.type(byName(container, "aluguel_mensal"), "8500");
    await userEvent.type(byName(container, "fundo_reserva"), "145.81");

    // Total: 8500 - 145.81 = 8354.19
    await waitFor(() =>
      expect(screen.getByText(/R\$\s*8\.354,19/)).toBeInTheDocument()
    );
  });

  it("inclui IPTU dividido por 10 e seguro por 12 quando marcados", async () => {
    const { container } = render(<LocacaoForm onSubmit={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /MB-001/ })).toBeInTheDocument()
    );

    await userEvent.type(byName(container, "aluguel_mensal"), "5000");
    // Desmarca o condomínio (default true)
    await userEvent.click(byName(container, "incluir_condominio_cobranca"));

    await userEvent.type(byName(container, "iptu_anual"), "1000");
    await userEvent.click(byName(container, "incluir_iptu_cobranca"));

    await userEvent.type(byName(container, "seguro_incendio_anual"), "1200");
    await userEvent.click(byName(container, "incluir_seguro_incendio_cobranca"));

    // 5000 + 100 (IPTU/10) + 100 (seguro/12) = 5200
    await waitFor(() =>
      expect(screen.getByText(/R\$\s*5\.200,00/)).toBeInTheDocument()
    );
  });

  it("preenche defaultValues quando editando", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <LocacaoForm
        onSubmit={onSubmit}
        submitLabel="Atualizar"
        defaultValues={{
          imovel_id: "imo-1",
          proprietario_id: "prop-1",
          locatario_id: "loc-1",
          data_inicio: "2026-01-01",
          data_fim: "2027-12-31",
          dia_vencimento: 10,
          aluguel_mensal: 9000,
        }}
      />
    );

    await waitFor(() =>
      expect((byName(container, "aluguel_mensal") as HTMLInputElement).value).toBe("9000")
    );
    expect((byName(container, "dia_vencimento") as HTMLInputElement).value).toBe("10");

    await userEvent.click(screen.getAllByRole("button", { name: "Atualizar" })[0]);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].dia_vencimento).toBe(10);
  });
});
