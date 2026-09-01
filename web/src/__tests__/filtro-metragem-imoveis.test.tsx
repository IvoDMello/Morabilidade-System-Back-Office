import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";

/**
 * Filtro de metragem da tela de Imóveis: mínima e máxima em m².
 *
 * A pergunta que ele existe para responder é "o que tem em Copacabana entre 100
 * e 240 m²", ou seja, bairro e metragem valendo ao mesmo tempo. Na API os dois
 * viram `.or_()` separados na mesma query, e é justamente esse par que dá para
 * quebrar em silêncio — se um sobrescrevesse o outro, a lista continuaria
 * cheia, só que respondendo outra pergunta. Por isso o teste do meio combina os
 * dois filtros em vez de conferir cada um sozinho.
 *
 * A página é montada de verdade, como nos testes de quartos e bairros: o que
 * importa é o que chega na API, não o texto do campo.
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

const LOCALIDADES = {
  cidades: ["Rio de Janeiro"],
  bairros: ["Copacabana", "Ipanema"],
  bairros_por_cidade: { "Rio de Janeiro": ["Copacabana", "Ipanema"] },
};

/** Params da última chamada a GET /imoveis/ (a de localidades é ignorada). */
function ultimosParams(): Record<string, string | string[]> {
  const chamadas = apiGetMock.mock.calls.filter((c) => c[0] === "/imoveis/");
  const ultima = chamadas[chamadas.length - 1];
  return (ultima?.[1]?.params ?? {}) as Record<string, string | string[]>;
}

const campoMin = () => screen.getByLabelText("Metragem mínima em m²");
const campoMax = () => screen.getByLabelText("Metragem máxima em m²");

async function montarTela() {
  const user = userEvent.setup();
  render(<ImoveisPage />);
  await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("/imoveis/localidades"));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/imoveis/localidades") return Promise.resolve({ data: LOCALIDADES });
    return Promise.resolve({ data: [], headers: { "x-total-count": "0" } });
  });
});

describe("filtro de metragem", () => {
  it("começa vazio e não manda parâmetro de área", async () => {
    await montarTela();

    expect(campoMin()).toHaveValue("");
    expect(campoMax()).toHaveValue("");
    expect(ultimosParams()).not.toHaveProperty("area_min");
    expect(ultimosParams()).not.toHaveProperty("area_max");
  });

  it("manda a faixa preenchida", async () => {
    const user = await montarTela();

    await user.type(campoMin(), "100");
    await user.type(campoMax(), "240");

    await waitFor(() => expect(ultimosParams().area_max).toBe("240"));
    expect(ultimosParams().area_min).toBe("100");
  });

  it("só o mínimo também vale — a busca fica sem teto", async () => {
    const user = await montarTela();

    await user.type(campoMin(), "300");

    await waitFor(() => expect(ultimosParams().area_min).toBe("300"));
    expect(ultimosParams()).not.toHaveProperty("area_max");
  });

  it("bairro e metragem valem juntos, é para isso que o filtro existe", async () => {
    const user = await montarTela();

    const gatilho = await screen.findByRole("button", { name: "Todos os bairros" });
    await waitFor(() => expect(gatilho).not.toBeDisabled());
    await user.click(gatilho);
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Copacabana" }));
    await user.keyboard("{Escape}");

    await user.type(campoMin(), "100");
    await user.type(campoMax(), "240");

    await waitFor(() => expect(ultimosParams().area_max).toBe("240"));
    expect(ultimosParams().area_min).toBe("100");
    expect(ultimosParams().bairro).toEqual(["Copacabana"]);
  });

  it("mínima maior que a máxima avisa em vez de devolver lista vazia sem explicação", async () => {
    const user = await montarTela();

    await user.type(campoMin(), "240");
    await user.type(campoMax(), "100");

    expect(await screen.findByText(/metragem mínima está maior que a máxima/i)).toBeInTheDocument();
  });

  it("aceita só dígitos — letra digitada no campo não vira parâmetro", async () => {
    const user = await montarTela();

    await user.type(campoMin(), "1a0b0");

    expect(campoMin()).toHaveValue("100");
    await waitFor(() => expect(ultimosParams().area_min).toBe("100"));
  });
});
