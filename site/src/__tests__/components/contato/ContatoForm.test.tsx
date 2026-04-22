import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContatoForm } from "@/components/contato/ContatoForm";

// Mocks externos
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  enviarContato: vi.fn().mockResolvedValue(undefined),
}));

describe("ContatoForm — renderização", () => {
  it("exibe os campos obrigatórios", () => {
    render(<ContatoForm />);
    expect(screen.getByPlaceholderText("Seu nome")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("seu@email.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/como podemos/i)).toBeInTheDocument();
  });

  it("exibe campo de telefone opcional", () => {
    render(<ContatoForm />);
    expect(screen.getByPlaceholderText(/\(00\)/)).toBeInTheDocument();
  });

  it("exibe botão de envio", () => {
    render(<ContatoForm />);
    expect(screen.getByRole("button", { name: /enviar mensagem/i })).toBeInTheDocument();
  });
});

describe("ContatoForm — pré-preenchimento por imóvel", () => {
  it("não pré-preenche mensagem sem codigoImovel", () => {
    render(<ContatoForm />);
    const textarea = screen.getByPlaceholderText(/como podemos/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("pré-preenche mensagem com o código do imóvel", () => {
    render(<ContatoForm codigoImovel="MOR-042" />);
    const textarea = screen.getByPlaceholderText(/como podemos/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("MOR-042");
  });

  it("mensagem pré-preenchida menciona interesse no imóvel", () => {
    render(<ContatoForm codigoImovel="MOR-042" />);
    const textarea = screen.getByPlaceholderText(/como podemos/i) as HTMLTextAreaElement;
    expect(textarea.value.toLowerCase()).toContain("interesse");
  });
});

describe("ContatoForm — validação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impede envio sem nome, email e mensagem", async () => {
    const { enviarContato } = await import("@/lib/api");
    const { toast } = await import("sonner");

    const { container } = render(<ContatoForm />);
    // fireEvent.submit ignora validação HTML5 nativa do jsdom e dispara o handler React
    fireEvent.submit(container.querySelector("form")!);

    expect(enviarContato).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("envia o formulário quando todos os campos obrigatórios estão preenchidos", async () => {
    const { enviarContato } = await import("@/lib/api");

    render(<ContatoForm />);

    await userEvent.type(screen.getByPlaceholderText("Seu nome"), "Maria Silva");
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "maria@email.com");
    await userEvent.type(screen.getByPlaceholderText(/como podemos/i), "Gostaria de mais informações.");
    await userEvent.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    await waitFor(() => {
      expect(enviarContato).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "Maria Silva",
          email: "maria@email.com",
          mensagem: "Gostaria de mais informações.",
        })
      );
    });
  });

  it("exibe confirmação após envio bem-sucedido", async () => {
    render(<ContatoForm />);

    await userEvent.type(screen.getByPlaceholderText("Seu nome"), "João Souza");
    await userEvent.type(screen.getByPlaceholderText("seu@email.com"), "joao@email.com");
    await userEvent.type(screen.getByPlaceholderText(/como podemos/i), "Tenho interesse.");
    await userEvent.click(screen.getByRole("button", { name: /enviar mensagem/i }));

    await waitFor(() => {
      expect(screen.getByText(/mensagem enviada/i)).toBeInTheDocument();
    });
  });
});
