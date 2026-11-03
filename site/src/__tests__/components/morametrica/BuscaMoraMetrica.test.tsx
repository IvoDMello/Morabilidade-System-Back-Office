import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { BuscaMoraMetrica } from "@/components/morametrica/BuscaMoraMetrica";
import { ProvedorNavegacao } from "@/components/morametrica/Navegacao";
import { sugerirMoraMetrica } from "@/lib/api";

vi.mock("@/lib/api", () => ({ sugerirMoraMetrica: vi.fn() }));

const push = vi.fn();

function renderizar(valorInicial = "") {
  return render(
    <ProvedorNavegacao>
      <BuscaMoraMetrica valorInicial={valorInicial} />
    </ProvedorNavegacao>,
  );
}

describe("BuscaMoraMetrica", () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn() } as never);
    vi.mocked(sugerirMoraMetrica).mockReset();
    vi.mocked(sugerirMoraMetrica).mockResolvedValue([
      { tipo: "bairro", rotulo: "Ipanema", detalhe: "Bairro", consulta: "Ipanema", bairro: "IPANEMA", cl: null, numero: null, unidade: null, transacoes: 10128 },
      { tipo: "logradouro", rotulo: "Avenida Vieira Souto", detalhe: "Ipanema", consulta: "Avenida Vieira Souto, 510", cl: 83360, numero: 510, unidade: null, bairro: null, transacoes: 437 },
    ]);
  });

  it("envia o texto digitado como busca livre", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.type(screen.getByRole("combobox"), "Leblon{Enter}");
    expect(push).toHaveBeenCalledWith("/morametrica?q=Leblon", { scroll: false });
  });

  it("mostra sugestões e escolhe pelo teclado, já com o número digitado", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.type(screen.getByRole("combobox"), "vieira souto 510");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    expect(sugerirMoraMetrica).toHaveBeenLastCalledWith("vieira souto 510", expect.any(AbortSignal));

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith(
      "/morametrica?q=Avenida+Vieira+Souto%2C+510&cl=83360&numero=510",
      { scroll: false },
    );
    expect(screen.getByRole("combobox")).toHaveValue("Avenida Vieira Souto, 510");
  });

  it("bairro sugerido busca direto pela chave", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.type(screen.getByRole("combobox"), "ipa");
    const [bairro] = await screen.findAllByRole("option");
    await user.pointer({ keys: "[MouseLeft>]", target: bairro });
    expect(push).toHaveBeenCalledWith("/morametrica?q=Ipanema&bairro=IPANEMA", { scroll: false });
  });

  it("não busca sugestões para o texto que veio da URL", () => {
    renderizar("Copacabana");
    expect(screen.getByRole("combobox")).toHaveValue("Copacabana");
    expect(sugerirMoraMetrica).not.toHaveBeenCalled();
  });

  it("exemplos levam à busca", async () => {
    const user = userEvent.setup();
    renderizar();
    await user.click(screen.getByRole("link", { name: "Vieira Souto 510" }));
    expect(push).toHaveBeenCalledWith("/morametrica?q=Vieira+Souto+510", { scroll: false });
  });
});
