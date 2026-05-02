import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocks de dependências externas
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (s: { setUser: () => void }) => unknown) =>
    selector({ setUser: vi.fn() }),
}));

// Import após mocks
import LoginPage from "@/app/(auth)/login/page";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Renderização ──────────────────────────────────────────────────────────────

describe("LoginPage — renderização", () => {
  it("exibe campo de e-mail", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument();
  });

  it("exibe campo de senha", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("exibe botão de entrar", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("exibe link para recuperar senha", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /esqueceu a senha/i })).toBeInTheDocument();
  });

  it("link de recuperação aponta para /recuperar-senha", () => {
    render(<LoginPage />);
    const link = screen.getByRole("link", { name: /esqueceu a senha/i });
    expect(link).toHaveAttribute("href", "/recuperar-senha");
  });
});

// ── Toggle de senha ───────────────────────────────────────────────────────────

describe("LoginPage — visibilidade da senha", () => {
  it("campo de senha começa como 'password'", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "password");
  });

  it("alterna para 'text' ao clicar no botão de visibilidade", async () => {
    render(<LoginPage />);
    const toggleBtn = screen.getByRole("button", { name: "" });
    await userEvent.click(toggleBtn);
    expect(screen.getByPlaceholderText("••••••••")).toHaveAttribute("type", "text");
  });
});

// ── Validação de formulário ───────────────────────────────────────────────────

describe("LoginPage — validação", () => {
  it("bloqueia envio com e-mail inválido (fetch não é chamado)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText("seu@email.com");
    const senhaInput = screen.getByPlaceholderText("••••••••");

    await userEvent.type(emailInput, "nao-e-email");
    await userEvent.type(senhaInput, "senha1234");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    // react-hook-form valida e bloqueia o submit — fetch nunca é chamado
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("bloqueia envio com senha curta (fetch não é chamado)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "user@teste.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "curta");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("não faz fetch se o formulário for inválido", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// ── Submissão ─────────────────────────────────────────────────────────────────

describe("LoginPage — submissão", () => {
  it("chama /api/auth/login com credenciais corretas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "1", nome_completo: "Admin", email: "a@a.com", perfil: "admin" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "admin@teste.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("admin@teste.com"),
        })
      );
    });

    vi.unstubAllGlobals();
  });

  it("exibe toast de erro ao receber resposta não-ok", async () => {
    const { toast } = await import("sonner");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "admin@teste.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/e-mail ou senha/i));
    });

    vi.unstubAllGlobals();
  });

  it("exibe 'Entrando...' durante o loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})) // nunca resolve
    );

    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "admin@teste.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /entrando/i })).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("botão fica desabilitado durante o loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {}))
    );

    render(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "admin@teste.com");
    await userEvent.type(screen.getByPlaceholderText("••••••••"), "senha1234");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /entrando/i })).toBeDisabled();
    });

    vi.unstubAllGlobals();
  });
});
