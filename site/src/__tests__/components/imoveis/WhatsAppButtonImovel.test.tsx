import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppButtonImovel } from "@/components/imoveis/WhatsAppButtonImovel";

const DEFAULT_PROPS = {
  codigo: "MOR-001",
  titulo: "Apartamento em Vila Nova, Campinas",
};

describe("WhatsAppButtonImovel", () => {
  it("renderiza link para o WhatsApp", () => {
    render(<WhatsAppButtonImovel {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toBeInTheDocument();
  });

  it("inclui o código do imóvel na mensagem", () => {
    render(<WhatsAppButtonImovel {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    const href = link.getAttribute("href") ?? "";
    const mensagem = decodeURIComponent(href.split("text=")[1] ?? "");
    expect(mensagem).toContain("MOR-001");
  });

  it("inclui o título do imóvel na mensagem", () => {
    render(<WhatsAppButtonImovel {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    const href = link.getAttribute("href") ?? "";
    const mensagem = decodeURIComponent(href.split("text=")[1] ?? "");
    expect(mensagem).toContain("Apartamento em Vila Nova, Campinas");
  });

  it("href aponta para wa.me com número de telefone", () => {
    render(<WhatsAppButtonImovel {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/\d+/));
  });

  it("tem z-index maior que o botão genérico (z-[60])", () => {
    render(<WhatsAppButtonImovel {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link.className).toMatch(/z-\[60\]/);
  });

  it("abre em nova aba com rel seguro", () => {
    render(<WhatsAppButtonImovel {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("gera mensagem diferente para imóveis distintos", () => {
    const { unmount } = render(<WhatsAppButtonImovel codigo="MOR-001" titulo="Casa em Bairro A" />);
    const href1 = (screen.getByRole("link", { name: /whatsapp/i }) as HTMLAnchorElement).href;
    unmount();

    render(<WhatsAppButtonImovel codigo="MOR-002" titulo="Apartamento em Bairro B" />);
    const href2 = (screen.getByRole("link", { name: /whatsapp/i }) as HTMLAnchorElement).href;

    expect(href1).not.toBe(href2);
  });
});
