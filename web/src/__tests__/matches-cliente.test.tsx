import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MatchesCliente } from "@/components/clientes/matches-cliente";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const apiGetMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

function matchFixture(overrides = {}) {
  return {
    imovel_id: "imo-1",
    codigo: "IMO-00001",
    cidade: "Rio de Janeiro",
    bairro: "Glória",
    tipo_imovel: "apartamento",
    tipo_negocio: "venda",
    valor_venda: 850000,
    dormitorios: 2,
    score: 5,
    ...overrides,
  };
}

const props = {
  clienteId: "cli-1",
  clienteNome: "Maria",
  clienteTelefone: "21999990000",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MatchesCliente", () => {
  it("mostra estado de carregamento inicialmente", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    render(<MatchesCliente {...props} />);
    expect(screen.getByText(/buscando oportunidades/i)).toBeInTheDocument();
  });

  it("busca os matches pelo id do cliente", async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    render(<MatchesCliente {...props} />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("/clientes/cli-1/matches")
    );
  });

  it("mostra estado vazio quando não há matches", async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    render(<MatchesCliente {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/nenhuma oportunidade no momento/i)).toBeInTheDocument()
    );
  });

  it("trata erro da API como lista vazia", async () => {
    apiGetMock.mockRejectedValue(new Error("falha"));
    render(<MatchesCliente {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/nenhuma oportunidade no momento/i)).toBeInTheDocument()
    );
  });

  it("renderiza o card do imóvel compatível", async () => {
    apiGetMock.mockResolvedValue({ data: [matchFixture()] });
    render(<MatchesCliente {...props} />);
    await waitFor(() => expect(screen.getByText("IMO-00001")).toBeInTheDocument());
    expect(screen.getByText(/Glória, Rio de Janeiro/)).toBeInTheDocument();
    expect(screen.getByText(/1 imóvel disponível/i)).toBeInTheDocument();
  });

  it("pluraliza o banner com mais de um match", async () => {
    apiGetMock.mockResolvedValue({
      data: [matchFixture(), matchFixture({ imovel_id: "imo-2", codigo: "IMO-00002" })],
    });
    render(<MatchesCliente {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/2 imóveis disponíveis/i)).toBeInTheDocument()
    );
  });

  it("mostra o botão de avisar via WhatsApp quando há telefone", async () => {
    apiGetMock.mockResolvedValue({ data: [matchFixture()] });
    render(<MatchesCliente {...props} />);
    await waitFor(() => screen.getByText("IMO-00001"));
    const avisar = screen.getByTitle(/avisar pelo whatsapp/i);
    expect(avisar).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  it("omite o botão de WhatsApp sem telefone do cliente", async () => {
    apiGetMock.mockResolvedValue({ data: [matchFixture()] });
    render(<MatchesCliente {...props} clienteTelefone="" />);
    await waitFor(() => screen.getByText("IMO-00001"));
    expect(screen.queryByTitle(/avisar pelo whatsapp/i)).not.toBeInTheDocument();
  });
});
