import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuthStore } from "@/lib/auth-store";

let pathname = "/imoveis";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

beforeEach(() => {
  pathname = "/imoveis";
  useAuthStore.setState({
    user: { id: "u1", nome_completo: "Ivo", email: "i@i.com", perfil: "admin" },
  });
});

describe("Sidebar — navegação acessível", () => {
  it("expõe um landmark de navegação rotulado", () => {
    render(<Sidebar isOpen onClose={vi.fn()} />);
    expect(
      screen.getByRole("navigation", { name: /navegação principal/i })
    ).toBeInTheDocument();
  });

  it("marca o item atual com aria-current=page", () => {
    render(<Sidebar isOpen onClose={vi.fn()} />);
    const imoveis = screen.getByRole("link", { name: /imóveis/i });
    expect(imoveis).toHaveAttribute("aria-current", "page");
  });

  it("não marca itens inativos com aria-current", () => {
    render(<Sidebar isOpen onClose={vi.fn()} />);
    const clientes = screen.getByRole("link", { name: /clientes/i });
    expect(clientes).not.toHaveAttribute("aria-current");
  });

  it("mostra o item admin-only Usuários para admins", () => {
    render(<Sidebar isOpen onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: /usuários/i })).toBeInTheDocument();
  });

  it("esconde Usuários de não-admins", () => {
    useAuthStore.setState({
      user: { id: "u2", nome_completo: "Rebeca", email: "r@r.com", perfil: "corretor" },
    });
    render(<Sidebar isOpen onClose={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /usuários/i })).not.toBeInTheDocument();
  });

  it("o botão de fechar tem rótulo acessível e dispara onClose", async () => {
    const onClose = vi.fn();
    render(<Sidebar isOpen onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /fechar menu/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
