import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

describe("WhatsAppButton", () => {
  it("renderiza link para o WhatsApp", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toBeInTheDocument();
  });

  it("abre em nova aba", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("href aponta para wa.me com número de telefone", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/wa\.me\/\d+/));
  });

  it("usa mensagem genérica da empresa", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    const href = link.getAttribute("href") ?? "";
    const mensagem = decodeURIComponent(href.split("text=")[1] ?? "");
    expect(mensagem).toContain("Morabilidade");
  });

  it("tem posicionamento fixo no canto inferior direito", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link.className).toMatch(/fixed/);
    expect(link.className).toMatch(/bottom/);
    expect(link.className).toMatch(/right/);
  });
});
