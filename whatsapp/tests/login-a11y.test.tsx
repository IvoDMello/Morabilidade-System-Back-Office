// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import LoginPage from "@/app/login/page";

expect.extend(toHaveNoViolations);

// A tela só usa o cliente Supabase ao submeter; mockamos para o teste montar
// sem tocar em rede/env.
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({ auth: {} }),
}));

/**
 * Testes de runtime (jsdom) que validam a usabilidade real da tela de login —
 * o que a análise estática não alcança: rótulos ligados aos campos, nomes
 * acessíveis dos botões e ausência de violações de acessibilidade (jest-axe).
 */
describe("Login — acessibilidade em runtime", () => {
  afterEach(cleanup);

  it("não tem violações de acessibilidade (jest-axe)", async () => {
    const { container } = render(<LoginPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("os campos e-mail e senha têm rótulo acessível ligado ao input", () => {
    render(<LoginPage />);
    const email = screen.getByLabelText("E-mail");
    const senha = screen.getByLabelText("Senha");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(senha).toHaveAttribute("type", "password");
    expect(senha).toHaveAttribute("autocomplete", "current-password");
  });

  it("o botão de mostrar/ocultar senha tem nome acessível e alterna o tipo", () => {
    render(<LoginPage />);
    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    const senha = screen.getByLabelText("Senha");
    expect(senha).toHaveAttribute("type", "password");
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
    // Após alternar, o nome acessível reflete a nova ação.
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toBeInTheDocument();
  });

  it("expõe a ação primária de entrar e o link de recuperar senha", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esqueci minha senha" })).toBeInTheDocument();
  });
});
