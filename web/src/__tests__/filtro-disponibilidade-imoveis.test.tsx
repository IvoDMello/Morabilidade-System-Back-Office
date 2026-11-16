import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";

/**
 * Filtro de disponibilidade da tela de Imóveis, com o "Em cadastro".
 *
 * A lista abre com disponível E em cadastro: é para o corretor achar o imóvel
 * que ainda não foi anunciado sem precisar mexer em filtro nenhum. O select é
 * de escolha única, então a opção padrão guarda as duas separadas por vírgula,
 * e o que dá para errar em silêncio é essa string chegar inteira na API (o
 * FastAPI recusaria) ou só com uma das duas. Por isso os testes olham os
 * params que saem, não o texto do select.
 */

const apiGetMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetMock(...args) },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (seletor: (s: unknown) => unknown) => seletor({ user: { perfil: "admin" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const IMOVEL_EM_CADASTRO = {
  id: "i-1",
  codigo: "MB-00042",
  tipo_negocio: "venda",
  disponibilidade: "em_cadastro",
  cidade: "Rio de Janeiro",
  bairro: "Botafogo",
  logradouro: "Rua Voluntários da Pátria",
  numero: "10",
  tipo_imovel: "apartamento",
  valor_venda: 900000,
  foto_capa: null,
  fotos: [],
  tags: [],
};

function ultimosParams(): Record<string, string | string[]> {
  const chamadas = apiGetMock.mock.calls.filter((c) => c[0] === "/imoveis/");
  const ultima = chamadas[chamadas.length - 1];
  return (ultima?.[1]?.params ?? {}) as Record<string, string | string[]>;
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/imoveis/localidades") {
      return Promise.resolve({ data: { cidades: [], bairros: [], bairros_por_cidade: {} } });
    }
    return Promise.resolve({ data: [], headers: { "x-total-count": "0" } });
  });
});

describe("filtro de disponibilidade", () => {
  it("abre pedindo disponível e em cadastro, cada um como parâmetro", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(ultimosParams().disponibilidade).toBeDefined());

    expect(ultimosParams().disponibilidade).toEqual(["disponivel", "em_cadastro"]);
    expect(screen.getByRole("combobox", { name: "Disponibilidade" })).toHaveTextContent(
      "Disponível e em cadastro",
    );
  });

  it("escolher só Disponível deixa de fora quem está em cadastro", async () => {
    const user = userEvent.setup();
    render(<ImoveisPage />);
    await waitFor(() => expect(ultimosParams().disponibilidade).toBeDefined());

    await user.click(screen.getByRole("combobox", { name: "Disponibilidade" }));
    await user.click(await screen.findByRole("option", { name: "Disponível" }));

    await waitFor(() => expect(ultimosParams().disponibilidade).toEqual(["disponivel"]));
  });

  it("Em cadastro sozinho também está no select", async () => {
    const user = userEvent.setup();
    render(<ImoveisPage />);
    await waitFor(() => expect(ultimosParams().disponibilidade).toBeDefined());

    await user.click(screen.getByRole("combobox", { name: "Disponibilidade" }));
    await user.click(await screen.findByRole("option", { name: "Em cadastro" }));

    await waitFor(() => expect(ultimosParams().disponibilidade).toEqual(["em_cadastro"]));
  });

  it("link com ?disponibilidade=todos traz a lista inteira", async () => {
    searchParams = new URLSearchParams("disponibilidade=todos");
    render(<ImoveisPage />);
    await waitFor(() =>
      expect(apiGetMock.mock.calls.some((c) => c[0] === "/imoveis/")).toBe(true),
    );

    expect(ultimosParams()).not.toHaveProperty("disponibilidade");
  });

  it("link do painel com ?disponibilidade=disponivel continua pedindo só disponível", async () => {
    searchParams = new URLSearchParams("disponibilidade=disponivel");
    render(<ImoveisPage />);
    await waitFor(() => expect(ultimosParams().disponibilidade).toBeDefined());

    expect(ultimosParams().disponibilidade).toEqual(["disponivel"]);
  });

  it("o card de um imóvel em cadastro diz que ele está fora do site", async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === "/imoveis/localidades") {
        return Promise.resolve({ data: { cidades: [], bairros: [], bairros_por_cidade: {} } });
      }
      return Promise.resolve({ data: [IMOVEL_EM_CADASTRO], headers: { "x-total-count": "1" } });
    });
    render(<ImoveisPage />);

    // O select também tem um "Em cadastro" (escondido até abrir); a etiqueta
    // do card é a que carrega o title.
    const etiqueta = await screen.findByTitle(/fora do site/);
    expect(etiqueta).toHaveTextContent("Em cadastro");
  });
});
