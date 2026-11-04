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
  Users: () => null, Building2: () => null, Search: () => null, Heart: () => null, Eye: () => null,
  TrendingUp: () => null, TrendingDown: () => null, SlidersHorizontal: () => null,
  X: () => null, Smartphone: () => null, Monitor: () => null, Tablet: () => null,
  Clock: () => null, ArrowRight: () => null, RefreshCw: () => null,
}));

// Recharts depende de ResizeObserver e width não-zero, substitui pelos stubs.
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
  atualizado_em: "2026-11-04T15:07:42-03:00",
  inicio: "2026-10-05",
  fim: "2026-11-03",
  historico_desde: "2026-09-05",
  detalhe_dias: 30,
  kpis: {
    visitas: { valor: 1284, delta: 18.2 },
    acessos: { valor: 4071, delta: 9.3 },
    vistas_imovel: { valor: 2819, delta: 24.0 },
    buscas: { valor: 612, delta: 15.7 },
    favoritos: { valor: 138, delta: -4.8 },
  },
  morametrica: {
    visitas: { valor: 57, delta: null },
    acessos: { valor: 66, delta: null },
    buscas: { valor: 240, delta: null },
    sem_resultado: { valor: 24, delta: null },
  },
  hoje: { visitas: 106, acessos: 365, mm_buscas: 12 },
  serie: [
    { dia: "2026-11-02", visitas: 80, acessos: 200, mm_visitas: 0, mm_acessos: 0, mm_buscas: 0 },
    { dia: "2026-11-03", visitas: 90, acessos: 250, mm_visitas: 20, mm_acessos: 25, mm_buscas: 70 },
  ],
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
    // "1.284" aparece no KPI Visitas e no card de Tendência, usa findAll.
    // Vários KPIs reaparecem em funil/origem; basta confirmar que cada valor existe pelo menos uma vez.
    expect((await screen.findAllByText("1.284")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("4.071").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2.819").length).toBeGreaterThan(0);
    expect(screen.getAllByText("612").length).toBeGreaterThan(0);
    expect(screen.getAllByText("138").length).toBeGreaterThan(0);
  });

  it("mostra o uso da MoraMétrica e o dia corrente à parte", async () => {
    render(<AudienciaPage />);
    expect(await screen.findByText("Uso da MoraMétrica")).toBeInTheDocument();
    expect(screen.getByText("240")).toBeInTheDocument();
    expect(screen.getByText("10% sem resultado")).toBeInTheDocument();
    expect(screen.getByText(/Hoje, até 15:07: 12 buscas/)).toBeInTheDocument();
    expect(screen.getByText(/Hoje, até 15:07: 106 visitas e 365 acessos/)).toBeInTheDocument();
    expect(screen.getByText("De 02/11/2026 a 03/11/2026, dias completos.")).toBeInTheDocument();
  });

  it("diz até quando os dados vão e atualiza no clique", async () => {
    render(<AudienciaPage />);
    expect(await screen.findByText("Atualizado às 15:07")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Atualizar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.get).mock.calls[1]).toEqual(["/analytics/dashboard", { params: { periodo: 30 } }]);
  });

  it("funciona com a API anterior, que não manda a hora da leitura", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { atualizado_em, ...semHora } = DASHBOARD_OK;
    vi.mocked(api.get).mockResolvedValue({ data: semHora } as never);
    render(<AudienciaPage />);
    expect(await screen.findByText(/Hoje, até agora: 12 buscas/)).toBeInTheDocument();
    expect(screen.getByText(/Hoje, até agora: 106 visitas e 365 acessos/)).toBeInTheDocument();
    expect(screen.queryByText(/Atualizado às/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Por dia" }));
    // fim = 03/11, então hoje = 04/11
    expect(screen.getByLabelText("Dia")).toHaveAttribute("max", "2026-11-04");
  });

  describe("MoraMétrica por dia", () => {
    function respondeDia(doDia: object) {
      vi.mocked(api.get).mockImplementation(((url: string) =>
        Promise.resolve({ data: url === "/analytics/morametrica/dia" ? doDia : DASHBOARD_OK })) as never);
    }

    async function abrePorDia() {
      render(<AudienciaPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Por dia" }));
    }

    it("abre no último dia completo e mostra os números dele", async () => {
      respondeDia({
        dia: "2026-11-03", completo: true, atualizado_em: "2026-11-04T15:07:42-03:00",
        numeros: { visitas: 1167, acessos: 1295, buscas: 6198, sem_resultado: 435 },
      });
      await abrePorDia();
      expect(await screen.findByText("6.198")).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith("/analytics/morametrica/dia", { params: { dia: "2026-11-03" } });
      expect(screen.getByText("Terça-feira, 03/11/2026: dia completo, da 0h à meia-noite.")).toBeInTheDocument();
      expect(screen.getByText("7% sem resultado")).toBeInTheDocument();
      expect(screen.getByText("1.167")).toBeInTheDocument();
      expect(screen.getByText("1.295")).toBeInTheDocument();
    });

    it("troca de dia pelo calendário, e hoje vem até a hora da leitura", async () => {
      respondeDia({
        dia: "2026-11-04", completo: false, atualizado_em: "2026-11-04T15:09:10-03:00",
        numeros: { visitas: 1446, acessos: 1581, buscas: 5378, sem_resultado: 429 },
      });
      await abrePorDia();
      const calendario = screen.getByLabelText("Dia");
      expect(calendario).toHaveAttribute("min", "2026-11-02");
      expect(calendario).toHaveAttribute("max", "2026-11-04");
      fireEvent.change(calendario, { target: { value: "2026-11-04" } });
      expect(await screen.findByText("Hoje, até 15:09. O dia ainda não terminou.")).toBeInTheDocument();
      expect(screen.getByText("5.378")).toBeInTheDocument();
    });

    it("não consulta dia antes do lançamento", async () => {
      respondeDia({});
      await abrePorDia();
      vi.mocked(api.get).mockClear();
      fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "2026-10-20" } });
      expect(await screen.findByText(/Escolha um dia entre 02\/11\/2026/)).toBeInTheDocument();
      expect(api.get).not.toHaveBeenCalledWith("/analytics/morametrica/dia", expect.anything());
    });

    it("avisa quando o dia não tem registro", async () => {
      respondeDia({ dia: "2026-11-03", completo: true, atualizado_em: "2026-11-04T15:07:42-03:00", numeros: null });
      await abrePorDia();
      expect(await screen.findByText("Não há registro deste dia.")).toBeInTheDocument();
    });

    it("volta para o período", async () => {
      respondeDia({
        dia: "2026-11-03", completo: true, atualizado_em: "2026-11-04T15:07:42-03:00",
        numeros: { visitas: 1, acessos: 1, buscas: 1, sem_resultado: 0 },
      });
      await abrePorDia();
      fireEvent.click(screen.getByRole("button", { name: "Período" }));
      expect(screen.getByText("240")).toBeInTheDocument();
      expect(screen.queryByLabelText("Dia")).not.toBeInTheDocument();
    });
  });

  it("avisa quando o histórico começa depois do início do período", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...DASHBOARD_OK, historico_desde: "2026-10-20" },
    } as never);
    render(<AudienciaPage />);
    expect(await screen.findByText(/O histórico começa em 20\/10\/2026/)).toBeInTheDocument();
  });

  it("não avisa quando o histórico cobre o período", async () => {
    render(<AudienciaPage />);
    await screen.findAllByText("1.284");
    expect(screen.queryByText(/O histórico começa em/)).not.toBeInTheDocument();
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
