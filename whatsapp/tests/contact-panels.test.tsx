// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { ContactPanels } from "@/features/contacts/components/contact-panels";

expect.extend(toHaveNoViolations);

function montar() {
  return render(
    <ContactPanels
      dados={<p>Corretor responsável</p>}
      atividade={<p>Histórico da conversa</p>}
    />,
  );
}

/** Utilitário: o painel escondido no celular continua no DOM (o desktop o
 * mostra pela mesma marcação), então o teste olha a classe que o esconde. */
function painelDe(texto: string): HTMLElement {
  const conteudo = screen.getByText(texto);
  const painel = conteudo.parentElement;
  if (!painel) throw new Error(`Painel não encontrado para "${texto}"`);
  return painel;
}

function escondidoNoCelular(texto: string): boolean {
  return painelDe(texto).className.includes("max-lg:hidden");
}

/**
 * A ficha do contato tem duas metades com propósitos diferentes — os dados
 * (quem é, quem atende, lembretes, imóveis) e a atividade (o histórico da
 * conversa). No desktop as duas convivem lado a lado, e é isso que faz a tela
 * boa. No celular não cabem: empilhar punia quem só queria a conversa.
 */
describe("Ficha do contato — dados e atividade", () => {
  afterEach(cleanup);

  it("não tem violações de acessibilidade (jest-axe)", async () => {
    const { container } = montar();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("abre nos dados — quem abre uma ficha veio ver quem é a pessoa", () => {
    montar();
    expect(escondidoNoCelular("Corretor responsável")).toBe(false);
    expect(escondidoNoCelular("Histórico da conversa")).toBe(true);
    expect(screen.getByRole("tab", { name: /Dados do contato/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("a primeira aba é a dos dados — a ordem acompanha a que abre", () => {
    montar();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Dados do contato",
      "Atividade",
    ]);
  });

  it("troca para a atividade sem perder os dados do DOM", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: /Atividade/ }));

    expect(escondidoNoCelular("Histórico da conversa")).toBe(false);
    expect(escondidoNoCelular("Corretor responsável")).toBe(true);
    expect(screen.getByRole("tab", { name: /Atividade/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("os dois conteúdos são renderizados sempre — no desktop aparecem juntos", () => {
    montar();
    // Nenhuma metade é desmontada: no desktop o `lg:` neutraliza o esconder, e
    // é assim que a tela lado a lado continua existindo com um só componente.
    expect(screen.getByText("Corretor responsável")).toBeInTheDocument();
    expect(screen.getByText("Histórico da conversa")).toBeInTheDocument();
  });

  it("o alternador some no desktop — controle que não decide nada é ruído", () => {
    montar();
    expect(screen.getByRole("tablist").className).toContain("lg:hidden");
  });

  it("os botões do alternador têm alvo de toque confortável", () => {
    montar();
    for (const aba of screen.getAllByRole("tab")) {
      expect(aba.className).toContain("min-h-9");
    }
  });
});
