import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// ── Mocks de módulos externos ─────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
}));

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
  Sparkles: () => null,
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

const RESUMO_VAZIO = { total_oportunidades: 0, clientes_com_preferencia: 0 };

beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/stats") return Promise.resolve({ data: STATS_VAZIO });
    if (url === "/oportunidades/resumo") return Promise.resolve({ data: RESUMO_VAZIO });
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

  it("exibe banner de oportunidades quando total > 0", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/stats") return Promise.resolve({ data: STATS_VAZIO });
      if (url === "/oportunidades/resumo")
        return Promise.resolve({ data: { total_oportunidades: 5, clientes_com_preferencia: 3 } });
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText(/5 oportunidades/)).toBeInTheDocument());
    expect(screen.getByText(/3 clientes/)).toBeInTheDocument();
  });

  it("não exibe banner de oportunidades quando total é 0", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText("Imóveis cadastrados")).toBeInTheDocument());
    expect(screen.queryByText(/oportunidade/)).not.toBeInTheDocument();
  });

  it("exibe singular 'oportunidade' (sem 's') quando total é 1", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/stats") return Promise.resolve({ data: STATS_VAZIO });
      if (url === "/oportunidades/resumo")
        return Promise.resolve({ data: { total_oportunidades: 1, clientes_com_preferencia: 1 } });
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    render(<DashboardHome />);
    await waitFor(() => expect(screen.getByText(/1 oportunidade/)).toBeInTheDocument());
    // Garante que não aparece o plural "oportunidades" no banner
    const el = screen.getByText(/1 oportunidade/);
    expect(el.textContent).not.toMatch(/oportunidades/);
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

  it("consome /stats e /oportunidades/resumo no mount", async () => {
    render(<DashboardHome />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/stats"));
    expect(api.get).toHaveBeenCalledWith("/oportunidades/resumo");
  });

  it("usa zeros quando /oportunidades/resumo falha", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/stats") return Promise.resolve({ data: STATS_VAZIO });
      if (url === "/oportunidades/resumo") return Promise.reject(new Error("offline"));
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    render(<DashboardHome />);
    // Não deve quebrar — banner não aparece
    await waitFor(() => expect(screen.getByText("Imóveis cadastrados")).toBeInTheDocument());
    expect(screen.queryByText(/oportunidade/)).not.toBeInTheDocument();
  });
});
