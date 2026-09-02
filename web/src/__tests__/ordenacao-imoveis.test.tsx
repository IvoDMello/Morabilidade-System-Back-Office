import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";
import { ajudaDaOrdem, alternarOrdem, paramsDeOrdenacao } from "@/lib/ordenacao-imoveis";

/**
 * Ordenação da listagem de Imóveis: valor e metragem, juntos ou separados.
 *
 * Três coisas delicadas moram aqui.
 *
 * A precedência entre a gaveta e o chip "4+" (que organiza por número de
 * quartos, senão "quatro ou mais" devolve os de quatro misturados com os de
 * sete): escolha explícita ganha, e sem escolha o "4+" ordena.
 *
 * A hierarquia entre os dois critérios, que é a POSIÇÃO na lista — o primeiro
 * manda, o segundo desempata. Trocada a ordem, a lista sai organizada pela
 * coisa errada.
 *
 * E a regra do clique: mudar a direção de um critério já escolhido não pode
 * rebaixá-lo a desempate.
 *
 * Nada disso aparece na tela como erro se estiver trocado: a lista só sai numa
 * ordem estranha, e é por isso que cada caso está travado aqui.
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

// O nome acessível diz o critério — "Crescente" sozinho seria ambíguo entre
// os dois pares de botões, que é justamente o que o aria-label resolve.
const botao = (criterio: "valor" | "metragem", direcao: "crescente" | "decrescente") =>
  screen.getByRole("button", { name: `Ordenar por ${criterio}, ${direcao}` });

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
  it("um critério só vira o param sozinho", () => {
    expect(paramsDeOrdenacao({ ordem: ["preco_asc"], quartosAberto: false })).toEqual({
      ordenar: "preco_asc",
    });
    expect(paramsDeOrdenacao({ ordem: ["metragem_desc"], quartosAberto: false })).toEqual({
      ordenar: "metragem_desc",
    });
  });

  it("dois critérios viram uma lista, na ordem em que valem", () => {
    expect(
      paramsDeOrdenacao({ ordem: ["preco_asc", "metragem_desc"], quartosAberto: false }),
    ).toEqual({ ordenar: "preco_asc,metragem_desc" });
    // Invertido, o desempate viraria o critério principal.
    expect(
      paramsDeOrdenacao({ ordem: ["metragem_desc", "preco_asc"], quartosAberto: false }),
    ).toEqual({ ordenar: "metragem_desc,preco_asc" });
  });

  it("sem escolha e sem 4+, nenhum parâmetro de ordem", () => {
    expect(paramsDeOrdenacao({ ordem: [], quartosAberto: false })).toEqual({});
  });

  it("sem escolha na gaveta, o 4+ ordena por quartos", () => {
    expect(paramsDeOrdenacao({ ordem: [], quartosAberto: true })).toEqual({
      ordenar: "dormitorios_asc",
    });
  });

  it("escolha explícita ganha do 4+", () => {
    expect(
      paramsDeOrdenacao({ ordem: ["metragem_desc"], quartosAberto: true }),
    ).toEqual({ ordenar: "metragem_desc" });
  });
});

describe("alternarOrdem", () => {
  it("critério novo entra no fim, como desempate", () => {
    expect(alternarOrdem(["preco_asc"], "metragem_desc")).toEqual([
      "preco_asc",
      "metragem_desc",
    ]);
  });

  it("botão aceso sai da lista", () => {
    expect(alternarOrdem(["preco_asc", "metragem_desc"], "preco_asc")).toEqual([
      "metragem_desc",
    ]);
  });

  it("trocar a direção mantém a posição do critério", () => {
    // Mudar de crescente para decrescente é mudar a direção, não recomeçar a
    // escolha: se a chave fosse para o fim, o critério principal viraria
    // desempate sem ninguém ter pedido.
    expect(alternarOrdem(["preco_asc", "metragem_desc"], "preco_desc")).toEqual([
      "preco_desc",
      "metragem_desc",
    ]);
    expect(alternarOrdem(["preco_asc", "metragem_desc"], "metragem_asc")).toEqual([
      "preco_asc",
      "metragem_asc",
    ]);
  });
});

describe("ajudaDaOrdem", () => {
  it("descreve o critério sozinho", () => {
    expect(ajudaDaOrdem({ ordem: ["preco_asc"], quartosAberto: false })).toBe(
      "Menor valor primeiro",
    );
    expect(ajudaDaOrdem({ ordem: ["preco_desc"], quartosAberto: false })).toBe(
      "Maior valor primeiro",
    );
    expect(ajudaDaOrdem({ ordem: ["metragem_asc"], quartosAberto: false })).toBe(
      "Menor metragem primeiro",
    );
    expect(ajudaDaOrdem({ ordem: ["metragem_desc"], quartosAberto: false })).toBe(
      "Maior metragem primeiro",
    );
  });

  it("com os dois, diz que o segundo só vale no empate do primeiro", () => {
    // É literalmente o alcance dele; sem essa frase, quem esperasse os dois
    // pesando junto ficaria procurando na lista um efeito que não existe.
    expect(
      ajudaDaOrdem({ ordem: ["preco_asc", "metragem_desc"], quartosAberto: false }),
    ).toBe("Menor valor primeiro; entre os de mesmo valor, maior metragem antes");
    expect(
      ajudaDaOrdem({ ordem: ["metragem_desc", "preco_asc"], quartosAberto: false }),
    ).toBe("Maior metragem primeiro; entre os de mesma metragem, menor valor antes");
  });

  it("sem escolha, descreve o que a lista está fazendo mesmo assim", () => {
    expect(ajudaDaOrdem({ ordem: [], quartosAberto: true })).toBe(
      "Do menor para o maior número de quartos",
    );
    expect(ajudaDaOrdem({ ordem: [], quartosAberto: false })).toBe(
      "Mais recentes primeiro",
    );
  });
});

describe("botões de ordenação na tela", () => {
  async function montar() {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
  }

  // O "1º"/"2º" ao lado do título, ou "" quando não há hierarquia a mostrar.
  const posicao = (titulo: "Valor" | "Metragem") =>
    within(screen.getByRole("group", { name: `Ordenar por ${titulo}` }))
      .queryByText(/^\d+º$/)?.textContent ?? "";

  it("abre sem nenhum marcado e sem mexer na ordem da lista", async () => {
    await montar();

    for (const criterio of ["valor", "metragem"] as const) {
      expect(botao(criterio, "crescente")).toHaveAttribute("aria-pressed", "false");
      expect(botao(criterio, "decrescente")).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByText("Mais recentes primeiro")).toBeInTheDocument();
    expect(ultimosParams()).not.toHaveProperty("ordenar");
  });

  it("crescente ordena do menor valor", async () => {
    await montar();

    fireEvent.click(botao("valor", "crescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc"));
    expect(screen.getByText("Menor valor primeiro")).toBeInTheDocument();
  });

  it("decrescente por metragem ordena da maior metragem", async () => {
    await montar();

    fireEvent.click(botao("metragem", "decrescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_desc"));
    expect(screen.getByText("Maior metragem primeiro")).toBeInTheDocument();
  });

  it("os dois juntos: quem foi escolhido antes manda", async () => {
    await montar();

    fireEvent.click(botao("valor", "crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc"));

    fireEvent.click(botao("metragem", "decrescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc,metragem_desc"));
    expect(botao("valor", "crescente")).toHaveAttribute("aria-pressed", "true");
    expect(botao("metragem", "decrescente")).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Menor valor primeiro; entre os de mesmo valor, maior metragem antes"),
    ).toBeInTheDocument();
  });

  it("escolhida a metragem primeiro, é ela que manda", async () => {
    // A tela não tem critério preferido: a hierarquia é a ordem do clique.
    await montar();

    fireEvent.click(botao("metragem", "crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_asc"));

    fireEvent.click(botao("valor", "decrescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_asc,preco_desc"));
  });

  it("o 1º e o 2º aparecem só quando há hierarquia a mostrar", async () => {
    await montar();

    fireEvent.click(botao("metragem", "crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_asc"));
    expect(posicao("Metragem")).toBe("");

    fireEvent.click(botao("valor", "decrescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_asc,preco_desc"));

    expect(posicao("Metragem")).toBe("1º");
    expect(posicao("Valor")).toBe("2º");
  });

  it("trocar a direção não rebaixa o critério a desempate", async () => {
    await montar();

    fireEvent.click(botao("valor", "crescente"));
    fireEvent.click(botao("metragem", "decrescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc,metragem_desc"));

    fireEvent.click(botao("valor", "decrescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_desc,metragem_desc"));
    expect(botao("valor", "crescente")).toHaveAttribute("aria-pressed", "false");
    expect(posicao("Valor")).toBe("1º");
  });

  it("desligar o principal promove o que sobrou", async () => {
    await montar();

    fireEvent.click(botao("valor", "crescente"));
    fireEvent.click(botao("metragem", "decrescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc,metragem_desc"));

    fireEvent.click(botao("valor", "crescente"));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_desc"));
    expect(screen.getByText("Maior metragem primeiro")).toBeInTheDocument();
  });

  it("clicar no que está ativo volta a lista para a ordem normal", async () => {
    await montar();

    fireEvent.click(botao("metragem", "decrescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_desc"));

    fireEvent.click(botao("metragem", "decrescente"));
    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("ordenar"));
    expect(screen.getByText("Mais recentes primeiro")).toBeInTheDocument();
  });

  it("com 4+ e sem escolha na gaveta, ordena por quartos", async () => {
    await montar();

    fireEvent.click(screen.getByRole("button", { name: /^4 quartos ou mais$/ }));

    await waitFor(() => expect(ultimosParams().ordenar).toBe("dormitorios_asc"));
    expect(screen.getByText("Do menor para o maior número de quartos")).toBeInTheDocument();
  });

  it("com 4+ marcado, escolher na gaveta assume a ordem", async () => {
    await montar();

    fireEvent.click(screen.getByRole("button", { name: /^4 quartos ou mais$/ }));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("dormitorios_asc"));

    fireEvent.click(botao("metragem", "crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("metragem_asc"));
    // O filtro de quartos continua valendo — mudou a ordem, não o recorte.
    expect(ultimosParams().dormitorios_min).toBe("4");
  });

  it("Limpar desmarca a ordenação junto com o resto", async () => {
    await montar();

    fireEvent.click(botao("valor", "crescente"));
    fireEvent.click(botao("metragem", "crescente"));
    await waitFor(() => expect(ultimosParams().ordenar).toBe("preco_asc,metragem_asc"));

    fireEvent.click(screen.getByRole("button", { name: /^Limpar$/ }));

    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("ordenar"));
    expect(botao("valor", "crescente")).toHaveAttribute("aria-pressed", "false");
    expect(botao("metragem", "crescente")).toHaveAttribute("aria-pressed", "false");
  });
});
