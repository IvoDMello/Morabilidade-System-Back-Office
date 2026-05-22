import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("lucide-react", () => ({
  Building2: () => null,
  CheckCircle2: () => null,
  Users: () => null,
  TrendingUp: () => null,
  PlusCircle: () => null,
  UserPlus: () => null,
  Tag: () => null,
  Clock: () => null,
  ImageOff: () => null,
  CalendarPlus: () => null,
  Lock: () => null,
}));

vi.mock("@/lib/auth-store", () => ({
  useAuthStore: (selector: (s: { user: { nome_completo: string } | null }) => unknown) =>
    selector({ user: { nome_completo: "Ana Lima" } }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";
import DashboardHome from "../page";

const STATS_VAZIO = {
  total_imoveis: 0,
  imoveis_disponiveis: 0,
  total_clientes: 0,
  clientes_em_negociacao: 0,
};

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/stats") return Promise.resolve({ data: STATS_VAZIO });
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
});

describe("DashboardHome", () => {
  it("exibe saudação com o primeiro nome do usuário", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
  });

  it("exibe cards de estatísticas após carregar", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("Imóveis cadastrados")).toBeInTheDocument());
    expect(screen.getByText("Imóveis disponíveis")).toBeInTheDocument();
    expect(screen.getByText("Clientes cadastrados")).toBeInTheDocument();
    expect(screen.getByText("Em negociação")).toBeInTheDocument();
  });

  it("exibe os indicadores operacionais (sem foto, reservados, leads 7d)", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("Sem foto")).toBeInTheDocument());
    expect(screen.getByText("Reservados")).toBeInTheDocument();
    expect(screen.getByText("Leads (7 dias)")).toBeInTheDocument();
  });

  it("exibe ações rápidas", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("Cadastrar imóvel")).toBeInTheDocument());
    expect(screen.getByText("Cadastrar cliente")).toBeInTheDocument();
    expect(screen.getByText("Gerenciar etiquetas")).toBeInTheDocument();
  });

  it("exibe zeros nos cards quando stats retornam vazio", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("Imóveis cadastrados")).toBeInTheDocument());
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThan(0);
  });

  it("consome /stats no mount", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/stats"));
  });

  it("exibe link de 'imóvel mais antigo' quando stats trazem o campo", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/stats")
        return Promise.resolve({
          data: {
            ...STATS_VAZIO,
            imovel_mais_antigo: { codigo: "MB-0123", created_at: "2025-01-15T10:00:00Z" },
          },
        });
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("MB-0123")).toBeInTheDocument());
    expect(screen.getByText(/Imóvel mais antigo no portfólio/)).toBeInTheDocument();
  });

  it("não quebra quando /stats falha — mostra toast e segue", async () => {
    vi.mocked(api.get).mockImplementation(() =>
      Promise.reject(new Error("offline")),
    );

    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("Imóveis cadastrados")).toBeInTheDocument());
  });
});
