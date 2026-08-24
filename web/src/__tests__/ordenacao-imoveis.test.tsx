import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";
import { ajudaDaOrdem, paramsDeOrdenacao } from "@/lib/ordenacao-imoveis";

/**
 * Ordenação da listagem de Imóveis: crescente/decrescente por valor.
 *
 * O ponto delicado é a precedência. Duas coisas podem querer mandar na ordem —
 * os botões de valor e o chip "4+" (que organiza por número de quartos, senão
 * "quatro ou mais" devolve os de quatro misturados com os de sete). Escolha
 * explícita ganha; sem escolha, o "4+" ordena. Nada disso aparece na tela como
 * erro se estiver trocado: a lista só sai numa ordem estranha, e é por isso que
 * cada caso está travado aqui.
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (seletor: (s: unknown) => unknown) => seletor({ user: { perfil: "admin" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function ultimosParams(): Record<string, string | string[]> {
  const chamadas = apiGetMock.mock.calls.filter((c) => c[0] === "/imoveis/");
  const ultima = chamadas[chamadas.length - 1];
  return (ultima?.[1]?.params ?? {}) as Record<string, string | string[]>;
}

const botao = (nome: string) => screen.getByRole("button", { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/imoveis/localidades") {
      return Promise.resolve({ data: { cidades: [], bairros: [], bairros_por_cidade: {} } });
    }
    return Promise.resolve({ data: [], headers: { "x-total-count": "0" } });
  });
});

describe("paramsDeOrdenacao", () => {
  it("crescente e decrescente ordenam por valor", () => {
    expect(paramsDeOrdenacao({ direcaoValor: "asc", quartosAberto: false })).toEqual({
      ordenar: "preco_asc",
    });
    expect(paramsDeOrdenacao({ direcaoValor: "desc", quartosAberto: false })).toEqual({
      ordenar: "preco_desc",
    });
  });

  it("sem escolha e sem 4+, nenhum parâmetro de ordem", () => {
    expect(paramsDeOrdenacao({ direcaoValor: "", quartosAberto: false })).toEqual({});
  });

  it("sem escolha de valor, o 4+ ordena por quartos", () => {
    expect(paramsDeOrdenacao({ direcaoValor: "", quartosAberto: true })).toEqual({
      ordenar: "dormitorios_asc",
    });
  });

  it("escolha explícita de valor ganha do 4+", () => {
    expect(paramsDeOrdenacao({ direcaoValor: "asc", quartosAberto: true })).toEqual({
      ordenar: "preco_asc",
    });
  });

  it("a linha de ajuda descreve o que está valendo", () => {
    expect(ajudaDaOrdem({ direcaoValor: "asc", quartosAberto: false })).toBe(
      "Menor valor primeiro",
    );
    expect(ajudaDaOrdem({ direcaoValor: "desc", quartosAberto: false })).toBe(
      "Maior valor primeiro",
    );
    expect(ajudaDaOrdem({ direcaoValor: "", quartosAberto: true })).toBe(
      "Do menor para o maior número de quartos",
    );
    expect(ajudaDaOrdem({ direcaoValor: "", quartosAberto: false })).toBe(
      "Mais recentes primeiro",
    );
  });
});

describe("botões de ordenação na tela", () => {
  async function montar() {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
  }

  it("abre sem nenhum marcado e sem mexer na ordem da lista", async () => {
    await montar();

    expect(botao("Crescente")).toHaveAttribute("aria-pressed", "false");
    expect(botao("Decrescente")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Mais recentes primeiro")).toBeInTheDocument();
    expect(ultimosParams()).not.toHaveProperty("ordenar");
  });

  it("crescente ordena do menor valor", async () => {
    await montar();

    fireEvent.click(botao("Crescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc"));
    expect(screen.getByText("Menor valor primeiro")).toBeInTheDocument();
  });

  it("escolher um desmarca o outro", async () => {
    await montar();

    fireEvent.click(botao("Crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc"));

    fireEvent.click(botao("Decrescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_desc"));
    expect(botao("Crescente")).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar no que está ativo volta a lista para a ordem normal", async () => {
    await montar();

    fireEvent.click(botao("Decrescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_desc"));

    fireEvent.click(botao("Decrescente"));
    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("ordenar"));
  });

  it("com 4+ e sem escolha de valor, ordena por quartos", async () => {
    await montar();

    fireEvent.click(screen.getByRole("button", { name: /^4 quartos ou mais$/ }));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("dormitorios_asc"));
    expect(screen.getByText("Do menor para o maior número de quartos")).toBeInTheDocument();
  });

  it("com 4+ marcado, escolher valor assume a ordem", async () => {
    await montar();

    fireEvent.click(screen.getByRole("button", { name: /^4 quartos ou mais$/ }));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("dormitorios_asc"));

    fireEvent.click(botao("Crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc"));
    // O filtro de quartos continua valendo — mudou a ordem, não o recorte.
    expect(ultimosParams().dormitorios_min).toBe("4");
  });

  it("Limpar desmarca a ordenação junto com o resto", async () => {
    await montar();

    fireEvent.click(botao("Crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc"));

    fireEvent.click(screen.getByRole("button", { name: /^Limpar$/ }));

    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("ordenar"));
    expect(botao("Crescente")).toHaveAttribute("aria-pressed", "false");
  });
});
