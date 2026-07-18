"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  AlertCircle,
  ClipboardList,
  CalendarClock,
  FileDown,
  Loader2,
  Package,
  Wallet,
  Receipt,
  Pencil as PencilIcon,
  Save,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatarMoeda, cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type {
  AdmCobrancaResumo,
  AnaliseLocacao,
  ContratoLocacaoListItem,
  DadosRecebimento,
  RepasseResumo,
  StatusLocacao,
} from "@/types";

type Tab = "contratos" | "analises" | "demonstrativos" | "repasses" | "adm_cobranca";

const STATUS_LABEL: Record<StatusLocacao, { label: string; class: string }> = {
  ativo: { label: "Ativo", class: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  em_encerramento: { label: "Em encerramento", class: "bg-amber-50 text-amber-700 ring-amber-200" },
  rescindido: { label: "Rescindido", class: "bg-red-50 text-red-700 ring-red-200" },
  encerrado: { label: "Encerrado", class: "bg-slate-100 text-slate-500 ring-slate-200" },
};

const PALETA = ["#585a4f", "#d8cb6a", "#8b8a72", "#c2b96a", "#a8a78f", "#e3d895"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function LocacoesPage() {
  const [tab, setTab] = useState<Tab>("contratos");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Adm Locação</h1>
          <p className="text-slate-500 text-sm">
            Cadastros, pagamentos e análise da carteira de locações.
          </p>
        </div>
      </div>

      {/* Tabs, rolagem horizontal no mobile para não estourar a largura */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <TabButton active={tab === "contratos"} onClick={() => setTab("contratos")}>
            <ClipboardList className="w-4 h-4" /> Contratos
          </TabButton>
          <TabButton active={tab === "analises"} onClick={() => setTab("analises")}>
            <TrendingDown className="w-4 h-4" /> Análises
          </TabButton>
          <TabButton
            active={tab === "demonstrativos"}
            onClick={() => setTab("demonstrativos")}
          >
            <Package className="w-4 h-4" /> Demonstrativos
          </TabButton>
          <TabButton
            active={tab === "repasses"}
            onClick={() => setTab("repasses")}
          >
            <Wallet className="w-4 h-4" /> Repasses
          </TabButton>
          <TabButton
            active={tab === "adm_cobranca"}
            onClick={() => setTab("adm_cobranca")}
          >
            <Receipt className="w-4 h-4" /> Adm. (cobrança)
          </TabButton>
        </nav>
      </div>

      {tab === "contratos" && <AbaContratos />}
      {tab === "analises" && <AbaAnalises />}
      {tab === "demonstrativos" && <AbaDemonstrativos />}
      {tab === "repasses" && <AbaRepasses />}
      {tab === "adm_cobranca" && <AbaAdmCobranca />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition shrink-0",
        active
          ? "border-[#585a4f] text-[#585a4f]"
          : "border-transparent text-slate-500 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}

// ── Aba Contratos ───────────────────────────────────────────────────────────

function AbaContratos() {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));

  const [contratos, setContratos] = useState<ContratoLocacaoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFiltro, setStatusFiltro] = useState<string>("");
  const [encerrando, setEncerrando] = useState<{ id: string; label: string } | null>(null);
  const [encerrandoLoading, setEncerrandoLoading] = useState(false);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buscar = useCallback(async (pg: number, filtro: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(pg),
        page_size: String(PAGE_SIZE),
      };
      if (filtro) params.status = filtro;
      const res = await api.get<ContratoLocacaoListItem[]>("/locacoes/", { params });
      setContratos(res.data);
      setTotal(Number(res.headers["x-total-count"] ?? res.data.length));
    } catch {
      toast.error("Erro ao carregar contratos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar(page, statusFiltro);
  }, [page, statusFiltro, buscar]);

  async function handleEncerrar() {
    if (!encerrando) return;
    setEncerrandoLoading(true);
    try {
      await api.delete(`/locacoes/${encerrando.id}`);
      toast.success("Contrato encerrado.");
      setEncerrando(null);
      buscar(page, statusFiltro);
    } catch {
      toast.error("Erro ao encerrar contrato.");
    } finally {
      setEncerrandoLoading(false);
    }
  }

  function formatarData(iso: string) {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  }

  function formatarMesAno(iso: string) {
    // mes_referencia vem como "YYYY-MM-01" do backend.
    const [ano, mes] = iso.split("-");
    return `${MESES_CURTOS[Number(mes) - 1]}/${ano.slice(2)}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <select
          value={statusFiltro}
          onChange={(e) => {
            setStatusFiltro(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="em_encerramento">Em encerramento</option>
          <option value="rescindido">Rescindidos</option>
          <option value="encerrado">Encerrados</option>
        </select>
        {isAdmin && (
          <Link
            href="/locacoes/novo"
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: "#585a4f" }}
          >
            + Novo contrato
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Carregando contratos...</div>
        ) : contratos.length === 0 ? (
          <div className="p-16 text-center">
            <FileSignature className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              {statusFiltro
                ? "Nenhum contrato encontrado com esse filtro."
                : "Nenhum contrato de locação cadastrado ainda."}
            </p>
            {!statusFiltro && isAdmin && (
              <Link
                href="/locacoes/novo"
                className="inline-block mt-3 text-sm font-medium hover:underline"
                style={{ color: "#585a4f" }}
              >
                Cadastrar primeiro contrato →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Imóvel</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Locatário</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Proprietário</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aluguel</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Último gerado</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vigência</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contratos.map((c) => {
                  const disp = STATUS_LABEL[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {c.imovel?.codigo ?? "-"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">
                          {c.imovel?.endereco ?? "-"}
                        </p>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-600">
                        {c.locatario?.nome ?? "-"}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-slate-600">
                        {c.proprietario?.nome ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${disp.class}`}
                        >
                          {disp.label}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-right text-slate-700 font-mono text-xs">
                        {formatarMoeda(Number(c.aluguel_mensal))}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-slate-500 text-xs">
                        {c.ultimo_mes_gerado ? (
                          formatarMesAno(c.ultimo_mes_gerado)
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-500 text-xs">
                        <p>{formatarData(c.data_inicio)}</p>
                        <p className="text-slate-400">até {formatarData(c.data_fim)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/locacoes/${c.id}`)}
                            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                            title={isAdmin ? "Editar" : "Visualizar"}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isAdmin && c.status !== "encerrado" && (
                            <button
                              onClick={() =>
                                setEncerrando({
                                  id: c.id,
                                  label: c.imovel?.codigo ?? "este contrato",
                                })
                              }
                              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                              title="Encerrar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!encerrando}
        onOpenChange={(open) => {
          if (!open) setEncerrando(null);
        }}
        title="Encerrar contrato"
        description={`Tem certeza que deseja encerrar o contrato de ${encerrando?.label ?? ""}? O histórico de pagamentos será preservado.`}
        loading={encerrandoLoading}
        onConfirm={handleEncerrar}
      />
    </div>
  );
}

// ── Aba Análises ────────────────────────────────────────────────────────────

function AbaAnalises() {
  const [data, setData] = useState<AnaliseLocacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AnaliseLocacao>("/locacoes/analises")
      .then((r) => setData(r.data))
      .catch(() => toast.error("Erro ao carregar análises."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Carregando análises...</div>;
  }
  if (!data) return null;

  const receita = MESES_CURTOS.map((m, i) => ({
    mes: m,
    prevista: data.receita_prevista_por_mes[i + 1] ?? 0,
    realizada: data.receita_realizada_por_mes[i + 1] ?? 0,
  }));

  const bairros = Object.entries(data.contratos_ativos_por_bairro).map(([bairro, qtd]) => ({
    bairro,
    qtd,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={<FileSignature className="w-5 h-5" />}
          label="Contratos ativos"
          valor={String(data.kpis.contratos_ativos)}
          cor="#585a4f"
        />
        <Kpi
          icon={<CalendarClock className="w-5 h-5" />}
          label="Em encerramento (60d)"
          valor={String(data.kpis.em_encerramento)}
          cor="#d8cb6a"
        />
        <Kpi
          icon={<TrendingDown className="w-5 h-5" />}
          label="Rescindidos no ano"
          valor={String(data.kpis.rescindidos_no_ano)}
          cor="#dc2626"
        />
        <Kpi
          icon={<AlertCircle className="w-5 h-5" />}
          label="Inadimplência"
          valor={`${data.kpis.inadimplencia_pct.toFixed(1)}%`}
          extra={`${formatarMoeda(data.kpis.valor_em_aberto)} em aberto`}
          cor="#ea580c"
        />
      </div>

      {/* Receita prevista vs realizada */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Receita {data.ano}: prevista vs realizada
        </h3>
        {receita.every((r) => r.prevista === 0 && r.realizada === 0) ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Sem pagamentos registrados no ano.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={receita}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Legend />
              <Bar dataKey="prevista" fill="#d8cb6a" name="Prevista" />
              <Bar dataKey="realizada" fill="#585a4f" name="Realizada" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Distribuição por bairro */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Contratos ativos por bairro
        </h3>
        {bairros.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Nenhum contrato ativo.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={bairros}
                dataKey="qtd"
                nameKey="bairro"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(props) => {
                  const p = props as { name?: string; value?: number };
                  return `${p.name ?? ""}: ${p.value ?? 0}`;
                }}
              >
                {bairros.map((_, i) => (
                  <Cell key={i} fill={PALETA[i % PALETA.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Aba Demonstrativos ──────────────────────────────────────────────────────

function AbaDemonstrativos() {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [gerando, setGerando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<{
    mes: string;
    gerados: number;
    erros: number;
    quando: Date;
  } | null>(null);

  async function handleGerarLote() {
    setGerando(true);
    try {
      const res = await api.post("/locacoes/demonstrativos", null, {
        params: { mes },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `demonstrativos_${mes}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      const gerados = Number(res.headers["x-gerados"] ?? 0);
      const erros = Number(res.headers["x-erros"] ?? 0);
      setUltimoResultado({ mes, gerados, erros, quando: new Date() });
      toast.success(
        `ZIP gerado: ${gerados} demonstrativo${gerados !== 1 ? "s" : ""}` +
          (erros > 0 ? ` · ${erros} com erro` : "")
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.error("Nenhum contrato ativo no mês.");
      } else {
        toast.error("Erro ao gerar lote de demonstrativos.");
      }
    } finally {
      setGerando(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800">Gerar lote do mês</h2>
        <p className="text-sm text-slate-500 mt-1">
          Baixa um ZIP com um PDF por contrato ativo, usando os valores cadastrados em
          cada contrato. Snapshots de pagamento já marcados como pagos não são
          sobrescritos.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Mês de competência
            </label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
            />
          </div>
          <button
            onClick={handleGerarLote}
            disabled={gerando || !mes}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-60"
            style={{ backgroundColor: "#585a4f" }}
          >
            {gerando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {gerando ? "Gerando ZIP..." : "Gerar e baixar ZIP"}
          </button>
        </div>
      </div>

      {ultimoResultado && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Última geração</h3>
          <p className="text-sm text-slate-600">
            Mês <strong>{ultimoResultado.mes}</strong>:{" "}
            <span className="text-emerald-700 font-medium">
              {ultimoResultado.gerados} gerado{ultimoResultado.gerados !== 1 ? "s" : ""}
            </span>
            {ultimoResultado.erros > 0 && (
              <span className="text-red-600 font-medium">
                {" "}
                · {ultimoResultado.erros} com erro
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Em {ultimoResultado.quando.toLocaleString("pt-BR")}.{" "}
            {ultimoResultado.erros > 0 && (
              <>Veja <code className="text-xs">_erros.txt</code> dentro do ZIP.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Aba Repasses ────────────────────────────────────────────────────────────

function AbaRepasses() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RepasseResumo | null>(null);

  const buscar = useCallback(async (mesRef: string) => {
    setLoading(true);
    try {
      const res = await api.get<RepasseResumo>("/locacoes/repasses", {
        params: { mes: mesRef },
      });
      setData(res.data);
    } catch {
      toast.error("Erro ao carregar repasses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar(mes);
  }, [mes, buscar]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Mês de competência
          </label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          />
        </div>
        {data && (
          <div className="flex-1 grid grid-cols-3 gap-3">
            <ResumoCard label="Recebido" valor={Number(data.total_recebido)} cor="#585a4f" />
            <ResumoCard label="Taxa adm." valor={Number(data.total_taxa)} cor="#d8cb6a" />
            <ResumoCard label="A repassar" valor={Number(data.total_repasse)} cor="#16a34a" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Carregando...</div>
      ) : !data || data.proprietarios.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Nenhum pagamento liquidado no mês.
        </div>
      ) : (
        <div className="space-y-4">
          {data.proprietarios.map((prop) => (
            <div key={prop.proprietario_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{prop.nome}</p>
                  {prop.email && (
                    <p className="text-xs text-slate-400">{prop.email}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">A repassar</p>
                  <p className="text-lg font-bold" style={{ color: "#16a34a" }}>
                    {formatarMoeda(Number(prop.total_repasse))}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Imóvel</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Taxa</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Repasse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {prop.itens.map((item) => (
                      <tr key={item.pagamento_id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-700">{item.imovel_codigo ?? "-"}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[300px]">
                            {item.imovel_endereco ?? "-"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                          {formatarMoeda(Number(item.valor_pago))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-500">
                          −{formatarMoeda(Number(item.valor_taxa))} ({Number(item.taxa_administracao_pct).toFixed(1)}%)
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: "#16a34a" }}>
                          {formatarMoeda(Number(item.valor_repasse))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Aba Adm. (cobrança) ─────────────────────────────────────────────────────
// Demonstrativo de Administração: cobra a taxa de adm. ao proprietário sobre o
// aluguel cheio de todos os contratos ativos. Modelo distinto do Repasse.

function AbaAdmCobranca() {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdmCobrancaResumo | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);

  const buscar = useCallback(async (mesRef: string) => {
    setLoading(true);
    try {
      const res = await api.get<AdmCobrancaResumo>("/locacoes/adm-cobranca", {
        params: { mes: mesRef },
      });
      setData(res.data);
    } catch {
      toast.error("Erro ao carregar a carteira de administração.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar(mes);
  }, [mes, buscar]);

  async function baixarPdf(proprietarioId: string, nome: string) {
    setBaixando(proprietarioId);
    try {
      const res = await api.get(
        `/locacoes/proprietarios/${proprietarioId}/demonstrativo-administracao`,
        { params: { mes }, responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
      a.download = `demonstrativo_administracao_${slug}_${mes}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Demonstrativo gerado.");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 404
          ? "Sem contratos ativos para este proprietário."
          : "Erro ao gerar o demonstrativo."
      );
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="space-y-6">
      {isAdmin && <DadosRecebimentoCard />}

      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Mês de competência
          </label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          />
        </div>
        {data && data.proprietarios.length > 0 && (
          <div className="flex-1 grid grid-cols-2 gap-3 min-w-[280px]">
            <ResumoCard label="Aluguéis administrados" valor={Number(data.total_aluguel)} cor="#585a4f" />
            <ResumoCard label="Comissão a cobrar" valor={Number(data.total_comissao)} cor="#16a34a" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Carregando...</div>
      ) : !data || data.proprietarios.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Nenhum contrato ativo com proprietário cadastrado.
        </div>
      ) : (
        <div className="space-y-4">
          {data.proprietarios.map((prop) => (
            <div key={prop.proprietario_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{prop.nome}</p>
                  <p className="text-xs text-slate-400">
                    {prop.qtd_imoveis} imóvel{prop.qtd_imoveis !== 1 ? "is" : ""} ·{" "}
                    Comissão {formatarMoeda(Number(prop.total_comissao))}
                    {prop.pct_uniforme != null
                      ? ` (${Number(prop.pct_uniforme).toString().replace(".", ",")}%)`
                      : " (taxas variadas)"}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => baixarPdf(prop.proprietario_id, prop.nome)}
                    disabled={baixando === prop.proprietario_id}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-60"
                    style={{ backgroundColor: "#585a4f" }}
                  >
                    {baixando === prop.proprietario_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    Baixar demonstrativo
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Imóvel</th>
                      <th className="hidden sm:table-cell text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bairro</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Aluguel</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {prop.itens.map((item) => (
                      <tr key={item.contrato_id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-700">{item.imovel_codigo ?? "-"}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[300px]">
                            {item.imovel_endereco ?? "-"}
                            {item.locatario_nome ? ` · ${item.locatario_nome}` : ""}
                          </p>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-2.5 text-slate-500 text-xs">
                          {item.bairro ?? "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700">
                          {formatarMoeda(Number(item.aluguel))}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold" style={{ color: "#16a34a" }}>
                          {formatarMoeda(Number(item.comissao))}
                          <span className="text-slate-400 font-normal">
                            {" "}({Number(item.taxa_administracao_pct).toString().replace(".", ",")}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DadosRecebimentoCard() {
  const [dados, setDados] = useState<DadosRecebimento | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get<DadosRecebimento>("/configuracoes/dados-recebimento")
      .then((r) => setDados(r.data))
      .catch(() => {/* silencioso: card só aparece p/ admin */});
  }, []);

  async function salvar() {
    if (!dados) return;
    setSalvando(true);
    try {
      const res = await api.put<DadosRecebimento>("/configuracoes/dados-recebimento", dados);
      setDados(res.data);
      setEditando(false);
      toast.success("Dados de recebimento atualizados.");
    } catch {
      toast.error("Erro ao salvar os dados de recebimento.");
    } finally {
      setSalvando(false);
    }
  }

  if (!dados) return null;

  const campos: { key: keyof DadosRecebimento; label: string }[] = [
    { key: "titular", label: "Titular" },
    { key: "banco", label: "Banco" },
    { key: "agencia", label: "Agência" },
    { key: "conta", label: "Conta" },
    { key: "pix", label: "PIX" },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Dados para pagamento</h3>
          <p className="text-xs text-slate-400">
            Conta que recebe a taxa, impressa no box do demonstrativo.
          </p>
        </div>
        {!editando ? (
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <PencilIcon className="w-3.5 h-3.5" /> Editar
          </button>
        ) : (
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-60"
            style={{ backgroundColor: "#585a4f" }}
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {campos.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
            {editando ? (
              <input
                value={dados[key]}
                onChange={(e) => setDados({ ...dados, [key]: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30"
              />
            ) : (
              <p className="text-sm text-slate-700">{dados[key] || "-"}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumoCard({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: cor }}>
        {formatarMoeda(valor)}
      </p>
    </div>
  );
}

function Kpi({
  icon,
  label,
  valor,
  extra,
  cor,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  extra?: string;
  cor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-500" style={{ color: cor }}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{valor}</p>
      {extra && <p className="text-xs text-slate-400 mt-1">{extra}</p>}
    </div>
  );
}

