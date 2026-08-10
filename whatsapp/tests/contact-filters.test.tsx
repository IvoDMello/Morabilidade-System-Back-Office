// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ContactFilters } from "@/features/contacts/components/contact-filters";

let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => params,
}));

/**
 * A barra de filtros de /contatos.
 *
 * Ela variava conforme a tela: o Status sumia no Pipeline ("a coluna já diz o
 * status") e o Imóvel só existia quando havia imóvel vinculado a algum
 * contato. Quem abria o mesmo app no celular via dois filtros e no desktop
 * quatro, sem nada que explicasse a diferença — e um filtro que aparece e
 * some ensina a não confiar na barra.
 *
 * Agora são três, sempre os mesmos: Categoria, Status e Lembretes.
 */
describe("Filtros de contatos", () => {
  afterEach(() => {
    cleanup();
    params = new URLSearchParams();
  });

  const ESPERADOS = ["Categoria", "Status", "Lembretes"];

  it("mostra os três filtros na Lista", () => {
    render(<ContactFilters />);
    for (const filtro of ESPERADOS) {
      expect(screen.getByText(filtro)).toBeInTheDocument();
    }
  });

  it("mostra os mesmos três no Pipeline", () => {
    params = new URLSearchParams("view=pipeline");
    render(<ContactFilters />);
    for (const filtro of ESPERADOS) {
      expect(screen.getByText(filtro)).toBeInTheDocument();
    }
  });

  it("não tem mais os filtros aposentados", () => {
    render(<ContactFilters />);
    // Imóvel dependia de dado que quase nunca existia; Ações e Favoritos
    // saíram junto com a próxima ação e o filtro de favoritos.
    expect(screen.queryByText("Imóvel")).not.toBeInTheDocument();
    expect(screen.queryByText("Ações")).not.toBeInTheDocument();
    expect(screen.queryByText("Favoritos")).not.toBeInTheDocument();
  });

  it("marca o chip ativo quando o filtro está na URL", () => {
    params = new URLSearchParams("status=documentacao");
    render(<ContactFilters />);
    expect(screen.getByText("Documentação")).toBeInTheDocument();
  });
});
