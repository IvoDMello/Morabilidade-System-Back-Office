// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import type { Contact } from "@/types/contact";
import { NovoLembreteButton } from "@/features/reminders-hub/components/novo-lembrete-button";

expect.extend(toHaveNoViolations);

// O botão navega com o router do Next ao escolher um contato; no teste só
// precisamos de um stub para montar.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const contatos = [
  { id: "1", name: "Ana Prado", phone: "5521999990000", category: "proprietario" },
  { id: "2", name: "Bruno Lima", phone: "5521888880000", category: "inquilino" },
] as unknown as Contact[];

/**
 * a11y de runtime do gatilho "Novo lembrete" da aba Lembretes — o mesmo padrão
 * de jest-axe usado no login, agora estendido para um segundo fluxo. Cobre o
 * estado padrão (fechado): sem violações e com nome acessível.
 */
describe("NovoLembreteButton — acessibilidade em runtime", () => {
  afterEach(cleanup);

  it("não tem violações de acessibilidade no estado padrão", async () => {
    const { container } = render(<NovoLembreteButton contacts={contatos} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("expõe um botão com nome acessível 'Novo lembrete'", () => {
    render(<NovoLembreteButton contacts={contatos} />);
    expect(screen.getByRole("button", { name: /novo lembrete/i })).toBeInTheDocument();
  });
});
