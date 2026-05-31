import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/audiencia",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("lucide-react", () => ({
  Users: () => null, Building2: () => null, Search: () => null, Heart: () => null,
  TrendingUp: () => null, TrendingDown: () => null, SlidersHorizontal: () => null,
  X: () => null, Smartphone: () => null, Monitor: () => null, Tablet: () => null,
  Clock: () => null, ArrowRight: () => null,
}));

// Recharts depende de ResizeObserver e width não-zero — substitui pelos stubs.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
}));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api";
import AudienciaPage from "../audiencia/page";

const DASHBOARD_OK = {
  periodo: 30,
  kpis: {
    visitantes_unicos: { valor: 1284, delta: 18.2 },
    vistas_imovel: { valor: 2819, delta: 24.0 },
    buscas: { valor: 612, delta: 15.7 },
    favoritos: { valor: 138, delta: -4.8 },
  },
  serie: [{ dia: "2026-05-30", visitantes: 80, views: 200 }],
  funil: { visitaram: 1284, buscaram: 892, abriram: 614, favoritaram: 138 },
  origem: [
    { origem: "Instagram", total: 412 },
    { origem: "Google · Orgânico", total: 316 },
  ],
  top_imoveis: [
    {
      imovel_id: "uuid-1", codigo: "MB-00001", titulo: "Cobertura Ipanema",
      bairro: "Ipanema", cidade: "Rio de Janeiro", tipo_negocio: "venda",
      total_views: 342, favoritos: 18, shares: 24,
    },
  ],
  bairros: [{ bairro: "Ipanema", buscas: 218, vistas: 412 }],
  dispositivos: [
    { dispositivo: "Celular", total: 90 },
    { dispositivo: "Computador", total: 30 },
  ],
  heatmap: [{ dow: 0, hora: 12, total: 25 }],
  termos: [{ termo: "apartamento ipanema", total: 64 }],
  buscas_vazias: [{ termo: "cobertura barra da tijuca", pessoas: 8 }],
};

describe("Página /audiencia", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: DASHBOARD_OK } as never);
  });

  it("chama /analytics/dashboard com período default = 30", async () => {
    render(<AudienciaPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(api.get).toHaveBeenCalledWith("/analytics/dashboard", { params: { periodo: 30 } });
  });

  it("renderiza KPIs com valores formatados em pt-BR", async () => {
    render(<AudienciaPage />);
    // "1.284" aparece no KPI Visitantes Únicos e no card de Tendência — usa findAll.
    // Vários KPIs reaparecem em funil/origem; basta confirmar que cada valor existe pelo menos uma vez.
    expect((await screen.findAllByText("1.284")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("2.819").length).toBeGreaterThan(0);
    expect(screen.getAllByText("612").length).toBeGreaterThan(0);
    expect(screen.getAllByText("138").length).toBeGreaterThan(0);
  });

  it("mostra delta positivo e negativo com sinal correto", async () => {
    const { container } = render(<AudienciaPage />);
    await screen.findAllByText("1.284");
    // O sinal "+" e o número são text nodes separados; checa textContent agregado.
    const html = container.textContent ?? "";
    expect(html).toMatch(/\+18\.2%/);
    expect(html).toMatch(/-4\.8%/);
  });

  it("alterna período e refaz a chamada", async () => {
    render(<AudienciaPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.get).mock.calls[1][1]).toEqual({ params: { periodo: 7 } });
  });

  it("renderiza top imóvel e bairro a partir dos dados", async () => {
    render(<AudienciaPage />);
    expect(await screen.findByText("Cobertura Ipanema")).toBeInTheDocument();
    expect(screen.getAllByText("Ipanema").length).toBeGreaterThan(0);
  });

  it("exibe fallback amigável quando a API falha", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("boom"));
    render(<AudienciaPage />);
    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
