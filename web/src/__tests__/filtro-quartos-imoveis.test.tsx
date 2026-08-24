import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";
import { paramsDeQuartos } from "@/lib/filtro-quartos";

/**
 * Filtro de quartos da tela de Imóveis: 1, 2, 3, 4+.
 *
 * A regra que dá para errar em silêncio é a tradução do chip para os params:
 * "2" precisa virar min E max, senão a busca traz também as coberturas de
 * cinco — resultado errado que a tela não tem como denunciar. Por isso os
 * testes atacam o valor que chega na API, e não o texto do botão.
 *
 * A página é montada de verdade em vez de repetir a montagem de params num
 * helper: o teste de CSV que já existe copia essa lógica, e cópia não pega
 * divergência — se alguém esquecer o campo no `buscar`, a cópia segue verde.
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
  useAuthStore: (seletor: (s: unknown) => unknown) =>
    seletor({ user: { perfil: "admin" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** Params da última chamada a GET /imoveis/ (a de localidades é ignorada). */
function ultimosParams(): Record<string, string> {
  const chamadas = apiGetMock.mock.calls.filter((c) => c[0] === "/imoveis/");
  const ultima = chamadas[chamadas.length - 1];
  return (ultima?.[1]?.params ?? {}) as Record<string, string>;
}

function chip(n: string) {
  return screen.getByRole("button", {
    name: n === "4" ? /^4 quartos ou mais$/ : new RegExp(`^${n} quartos?$`),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/imoveis/localidades") {
      return Promise.resolve({
        data: { cidades: [], bairros: [], bairros_por_cidade: {} },
      });
    }
    return Promise.resolve({ data: [], headers: { "x-total-count": "0" } });
  });
});

describe("paramsDeQuartos", () => {
  it("1, 2 e 3 são contagem exata — mandam teto junto", () => {
    expect(paramsDeQuartos("1")).toEqual({ dormitorios_min: "1", dormitorios_max: "1" });
    expect(paramsDeQuartos("2")).toEqual({ dormitorios_min: "2", dormitorios_max: "2" });
    expect(paramsDeQuartos("3")).toEqual({ dormitorios_min: "3", dormitorios_max: "3" });
  });

  it("4+ é o único aberto — vai sem teto", () => {
    expect(paramsDeQuartos("4")).toEqual({ dormitorios_min: "4" });
  });

  it("não manda ordenação: quem é dono do `ordenar` é o controle de ordem", () => {
    // Enquanto os dois mandavam, quem escolhesse "4+" e depois "ordenar por
    // preço" ficava na mão de quem escrevesse por último.
    for (const n of ["1", "2", "3", "4"]) {
      expect(paramsDeQuartos(n)).not.toHaveProperty("ordenar");
    }
  });

  it("sem escolha, nenhum param", () => {
    expect(paramsDeQuartos("")).toEqual({});
  });
});

describe("filtro de quartos na tela", () => {
  it("oferece 1, 2, 3 e 4+ e nenhum vem marcado", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    for (const n of ["1", "2", "3", "4"]) {
      expect(chip(n)).toHaveAttribute("aria-pressed", "false");
    }
    expect(ultimosParams()).not.toHaveProperty("dormitorios_min");
  });

  it("escolher 2 pede exatamente 2 — não traz os de cinco", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    fireEvent.click(chip("2"));

    await waitFor(() => expect(ultimosParams().dormitorios_min).toBe("2"));
    expect(ultimosParams().dormitorios_max).toBe("2");
  });

  it("escolher 4+ abre o teto e já deixa a lista em ordem de quartos", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    fireEvent.click(chip("4"));

    await waitFor(() => expect(ultimosParams().dormitorios_min).toBe("4"));
    expect(ultimosParams()).not.toHaveProperty("dormitorios_max");
    // A ordem que o "4+" pede é regra de precedência e vive em
    // ordenacao-imoveis.test.tsx; aqui interessa só o recorte.
    expect(ultimosParams().ordenar).toBe("dormitorios_asc");
  });

  it("clicar no que já está ativo limpa o filtro", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    fireEvent.click(chip("3"));
    await waitFor(() => expect(ultimosParams().dormitorios_min).toBe("3"));

    fireEvent.click(chip("3"));
    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("dormitorios_min"));
    expect(ultimosParams()).not.toHaveProperty("dormitorios_max");
  });

  it("trocar de 4+ para 2 não deixa o teto antigo para trás", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    fireEvent.click(chip("4"));
    await waitFor(() => expect(ultimosParams().dormitorios_min).toBe("4"));

    fireEvent.click(chip("2"));
    await waitFor(() => expect(ultimosParams().dormitorios_min).toBe("2"));
    expect(ultimosParams().dormitorios_max).toBe("2");
  });

  it("Limpar tira o filtro de quartos junto com o resto", async () => {
    render(<ImoveisPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    fireEvent.click(chip("3"));
    await waitFor(() => expect(ultimosParams().dormitorios_min).toBe("3"));

    fireEvent.click(screen.getByRole("button", { name: /^Limpar$/ }));
    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("dormitorios_min"));
  });
});
