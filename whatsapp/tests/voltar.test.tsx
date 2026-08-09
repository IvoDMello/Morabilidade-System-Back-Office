// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BackLink } from "@/components/layout/back-link";
import { MobileHeader } from "@/components/layout/mobile-header";

/** Rota atual do teste da vez — o mock de usePathname lê daqui. */
let rota = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => rota,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  rota = "/";
});
afterEach(cleanup);

/**
 * A seta de voltar é o único caminho de saída das telas internas: a barra de
 * navegação leva às cinco seções, mas de dentro da ficha de um contato (ou de
 * um formulário) não havia como subir um nível sem o botão do sistema — que no
 * PWA instalado nem aparece.
 */
describe("Seta de voltar no header mobile", () => {
  it("aparece na ficha do contato, apontando para a lista", () => {
    rota = "/contatos/contato-1";
    render(<MobileHeader />);

    const voltar = screen.getByRole("link", { name: "Voltar para Contatos" });
    expect(voltar).toHaveAttribute("href", "/contatos");
  });

  it("no formulário de edição sobe só um degrau, de volta para a ficha", () => {
    rota = "/contatos/contato-1/editar";
    render(<MobileHeader />);

    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute(
      "href",
      "/contatos/contato-1",
    );
  });

  it("não aparece nas telas de primeiro nível", () => {
    for (const topo of ["/", "/pendencias", "/contatos", "/assistente", "/dashboard"]) {
      cleanup();
      rota = topo;
      render(<MobileHeader />);
      expect(screen.queryByRole("link", { name: /Voltar/ }), `seta indevida em ${topo}`).toBeNull();
    }
  });

  it("não engole o título nem o menu do usuário", () => {
    rota = "/contatos/contato-1";
    render(<MobileHeader />);

    expect(screen.getByRole("heading", { name: "Contatos" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Menu do usuário" })).toBeVisible();
  });
});

describe("Seta de voltar no desktop", () => {
  it("mostra o destino escrito — no desktop há largura para o rótulo", () => {
    rota = "/contatos/contato-1";
    render(<BackLink withLabel />);

    // Rótulo visível em vez de aria-label: repetir o texto nos dois lugares faz
    // o leitor de tela anunciar duas vezes.
    const voltar = screen.getByRole("link", { name: "Voltar para Contatos" });
    expect(voltar).toHaveTextContent("Voltar para Contatos");
    expect(voltar).not.toHaveAttribute("aria-label");
  });
});
