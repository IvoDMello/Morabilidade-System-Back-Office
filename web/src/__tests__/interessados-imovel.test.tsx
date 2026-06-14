import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { InteressadosImovel } from "@/components/imoveis/interessados-imovel";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const apiGetMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

function interessadoFixture(overrides = {}) {
  return {
    cliente_id: "cli-1",
    nome_completo: "Carlos Lima",
    telefone: "21988887777",
    email: "carlos@teste.com",
    tipo_cliente: "comprador",
    preferencia_id: "pref-1",
    score: 6,
    ...overrides,
  };
}

const props = {
  imovelId: "imo-1",
  imovelCodigo: "IMO-00009",
  imovelBairro: "Botafogo",
  imovelCidade: "Rio de Janeiro",
  imovelTipoNegocio: "venda",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InteressadosImovel", () => {
  it("mostra estado de carregamento inicialmente", () => {
    apiGetMock.mockImplementation(() => new Promise(() => {}));
    render(<InteressadosImovel {...props} />);
    expect(screen.getByText(/buscando clientes interessados/i)).toBeInTheDocument();
  });

  it("busca interessados pelo id do imóvel", async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    render(<InteressadosImovel {...props} />);
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith("/imoveis/imo-1/interessados")
    );
  });

  it("mostra estado vazio quando ninguém casa", async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    render(<InteressadosImovel {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/nenhum cliente cadastrado/i)).toBeInTheDocument()
    );
  });

  it("trata erro da API como lista vazia", async () => {
    apiGetMock.mockRejectedValue(new Error("falha"));
    render(<InteressadosImovel {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/nenhum cliente cadastrado/i)).toBeInTheDocument()
    );
  });

  it("renderiza o cliente interessado", async () => {
    apiGetMock.mockResolvedValue({ data: [interessadoFixture()] });
    render(<InteressadosImovel {...props} />);
    await waitFor(() => expect(screen.getByText("Carlos Lima")).toBeInTheDocument());
    expect(screen.getByText(/21988887777/)).toBeInTheDocument();
    expect(screen.getByText(/1 cliente com preferência ativa/i)).toBeInTheDocument();
  });

  it("mostra observações da preferência quando existem", async () => {
    apiGetMock.mockResolvedValue({
      data: [interessadoFixture({ observacoes_preferencia: "Quer andar alto" })],
    });
    render(<InteressadosImovel {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/quer andar alto/i)).toBeInTheDocument()
    );
  });

  it("pluraliza o banner com mais de um interessado", async () => {
    apiGetMock.mockResolvedValue({
      data: [interessadoFixture(), interessadoFixture({ cliente_id: "cli-2" })],
    });
    render(<InteressadosImovel {...props} />);
    await waitFor(() =>
      expect(screen.getByText(/2 clientes com preferência ativa/i)).toBeInTheDocument()
    );
  });

  it("monta link do WhatsApp com dados do imóvel", async () => {
    apiGetMock.mockResolvedValue({ data: [interessadoFixture()] });
    render(<InteressadosImovel {...props} />);
    await waitFor(() => screen.getByText("Carlos Lima"));
    const avisar = screen.getByTitle(/avisar pelo whatsapp/i);
    expect(avisar).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });
});
