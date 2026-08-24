import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import ImoveisPage from "@/app/(dashboard)/imoveis/page";

/**
 * Filtro de bairros da tela de Imóveis, agora com escolha múltipla.
 *
 * A API sempre soube responder vários bairros (`_aplicar_filtros` monta um OR),
 * mas três camadas no meio limitavam a um: o `Select` do Radix é single-value, o
 * proxy do Next usava `set` (que sobrescreve parâmetro repetido) e o axios
 * serializa array como `bairro[]=`, que o FastAPI ignora. Nenhuma das três dava
 * erro — o filtro só filtrava menos do que dizia, e é por isso que cada uma
 * ganhou teste próprio (o proxy tem o dele em api-proxy.test.ts).
 *
 * `userEvent` e não `fireEvent`: o Radix abre o menu no pointerdown, que o
 * clique sintético do fireEvent não dispara.
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
  bairros: ["Botafogo", "Copacabana", "Ipanema", "Leblon"],
  bairros_por_cidade: { "Rio de Janeiro": ["Ipanema", "Leblon"] },
};

function ultimosParams(): Record<string, string | string[]> {
  const chamadas = apiGetMock.mock.calls.filter((c) => c[0] === "/imoveis/");
  const ultima = chamadas[chamadas.length - 1];
  return (ultima?.[1]?.params ?? {}) as Record<string, string | string[]>;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/imoveis/localidades") return Promise.resolve({ data: LOCALIDADES });
    return Promise.resolve({ data: [], headers: { "x-total-count": "0" } });
  });
});

/** Monta a tela e deixa o menu de bairros aberto. */
async function abrirMenuDeBairros() {
  const user = userEvent.setup();
  render(<ImoveisPage />);
  await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("/imoveis/localidades"));

  const gatilho = await screen.findByRole("button", { name: "Todos os bairros" });
  await waitFor(() => expect(gatilho).not.toBeDisabled());
  await user.click(gatilho);
  await screen.findByRole("menuitemcheckbox", { name: "Ipanema" });

  const marcar = (nome: string) =>
    user.click(screen.getByRole("menuitemcheckbox", { name: nome }));
  return { user, gatilho, marcar };
}

describe("filtro de bairros", () => {
  it("permite marcar mais de um bairro sem o menu fechar no caminho", async () => {
    const { marcar } = await abrirMenuDeBairros();

    await marcar("Ipanema");
    await marcar("Copacabana");

    await waitFor(() => expect(ultimosParams().bairro).toEqual(["Ipanema", "Copacabana"]));
  });

  it("desmarcar tira só aquele bairro", async () => {
    const { marcar } = await abrirMenuDeBairros();

    await marcar("Ipanema");
    await marcar("Leblon");
    await waitFor(() => expect(ultimosParams().bairro).toEqual(["Ipanema", "Leblon"]));

    await marcar("Ipanema");
    await waitFor(() => expect(ultimosParams().bairro).toEqual(["Leblon"]));
  });

  it("o gatilho resume o que está escolhido", async () => {
    const { gatilho, marcar } = await abrirMenuDeBairros();

    await marcar("Ipanema");
    await waitFor(() => expect(gatilho).toHaveTextContent("Ipanema"));

    await marcar("Leblon");
    await waitFor(() => expect(gatilho).toHaveTextContent("Ipanema, Leblon"));

    // A partir de três, a contagem informa mais que uma lista cortada no meio.
    await marcar("Copacabana");
    await waitFor(() => expect(gatilho).toHaveTextContent("3 bairros"));
  });

  it('"Todos os bairros" limpa a seleção inteira de uma vez', async () => {
    const { user, marcar } = await abrirMenuDeBairros();

    await marcar("Ipanema");
    await marcar("Leblon");
    await waitFor(() => expect(ultimosParams().bairro).toEqual(["Ipanema", "Leblon"]));

    await user.click(screen.getByRole("menuitem", { name: "Todos os bairros" }));
    await waitFor(() => expect(ultimosParams()).not.toHaveProperty("bairro"));
  });

  it("sem nada marcado, nenhum parâmetro de bairro é enviado", async () => {
    await abrirMenuDeBairros();
    expect(ultimosParams()).not.toHaveProperty("bairro");
  });
});

describe("serialização dos parâmetros", () => {
  it("array vira parâmetro repetido, não bairro[]", async () => {
    // O FastAPI só lê `List[str]` quando a chave se repete sem colchetes; com o
    // padrão do axios o parâmetro chega irreconhecível e é ignorado calado.
    const instancia = axios.create({
      adapter: async (config) => {
        capturada = instancia.getUri(config);
        return { data: [], status: 200, statusText: "OK", headers: {}, config };
      },
      paramsSerializer: { indexes: null },
    });
    let capturada = "";

    await instancia.get("/imoveis/", { params: { bairro: ["Ipanema", "Leblon"] } });

    expect(capturada).toContain("bairro=Ipanema");
    expect(capturada).toContain("bairro=Leblon");
    expect(capturada).not.toContain("bairro%5B%5D");
    expect(capturada).not.toContain("bairro[]");
  });
});
