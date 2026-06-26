"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Building2, Search as SearchIcon, Heart,
  TrendingUp, TrendingDown, SlidersHorizontal, X, Smartphone, Monitor, Tablet,
  Clock, ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { api } from "@/lib/api";
import { RelatoriosTabs } from "@/components/layout/relatorios-tabs";

// ── Tipos ────────────────────────────────────────────────────────────────────
type Periodo = 7 | 30 | 90 | 365;

interface KpiValue { valor: number; delta: number | null }

interface DashboardData {
  periodo: number;
  kpis: {
    visitantes_unicos: KpiValue;
    vistas_imovel: KpiValue;
    buscas: KpiValue;
    favoritos: KpiValue;
  };
  serie: { dia: string; visitantes: number; views: number }[];
  funil: { visitaram: number; buscaram: number; abriram: number; favoritaram: number };
  origem: { origem: string; total: number }[];
  top_imoveis: {
    imovel_id: string; codigo: string; titulo: string | null;
    bairro: string | null; cidade: string | null; tipo_negocio: string;
    total_views: number; favoritos: number; shares: number;
  }[];
  bairros: { bairro: string; buscas: number; vistas: number }[];
  dispositivos: { dispositivo: string; total: number }[];
  heatmap: { dow: number; hora: number; total: number }[];
  termos: { termo: string; total: number }[];
  buscas_vazias: { termo: string; pessoas: number }[];
}

const OLIVE = "#585a4f";
const GOLD = "#d8cb6a";
const PALETTE = [GOLD, OLIVE, "#9a9a82", "#bfb56a", "#3e4037", "#d6d3c4"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}
function labelPeriodo(p: Periodo): string {
  if (p === 365) return "12 meses";
  return `${p} dias`;
}

// ── Toolbar (período + filtros) ──────────────────────────────────────────────
const PERIODOS: { v: Periodo; label: string }[] = [
  { v: 7, label: "7 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
  { v: 365, label: "12 meses" },
];

interface FiltrosUI {
  tipo_negocio: string;
  tipo_imovel: string;
  bairro: string;
}
const FILTROS_VAZIO: FiltrosUI = { tipo_negocio: "", tipo_imovel: "", bairro: "" };

function Toolbar({
  periodo, onPeriodo, filtros, onFiltros,
}: {
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
  filtros: FiltrosUI;
  onFiltros: (f: FiltrosUI) => void;
}) {
  const [modalAberto, setModalAberto] = useState(false);
  const qtdFiltros = Object.values(filtros).filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Período
      </span>
      <div className="flex items-center gap-1 bg-slate-50 rounded-full p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => onPeriodo(p.v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              periodo === p.v ? "text-white" : "text-slate-500 hover:text-slate-700"
            }`}
            style={periodo === p.v ? { backgroundColor: "#1f2120" } : undefined}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
        <Clock className="w-3.5 h-3.5" /> Comparado ao período anterior
      </div>
      <div className="ml-auto">
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {qtdFiltros > 0 && (
            <span
              className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: OLIVE }}
            >
              {qtdFiltros}
            </span>
          )}
        </button>
      </div>

      {modalAberto && (
        <ModalFiltros
          inicial={filtros}
          onClose={() => setModalAberto(false)}
          onAplicar={(f) => { onFiltros(f); setModalAberto(false); }}
        />
      )}
    </div>
  );
}

function ModalFiltros({
  inicial, onClose, onAplicar,
}: {
  inicial: FiltrosUI;
  onClose: () => void;
  onAplicar: (f: FiltrosUI) => void;
}) {
  const [f, setF] = useState<FiltrosUI>(inicial);
  const inputCls =
    "w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 " +
    "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/20 focus:border-[#585a4f]/40 transition";
  const labelCls = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Filtros</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Negócio</label>
            <select
              value={f.tipo_negocio}
              onChange={(e) => setF({ ...f, tipo_negocio: e.target.value })}
              className={inputCls}
            >
              <option value="">Todos</option>
              <option value="venda">Venda</option>
              <option value="locacao">Locação</option>
              <option value="ambos">Venda + Locação</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Tipo de imóvel</label>
            <select
              value={f.tipo_imovel}
              onChange={(e) => setF({ ...f, tipo_imovel: e.target.value })}
              className={inputCls}
            >
              <option value="">Todos</option>
              <option value="apartamento">Apartamento</option>
              <option value="casa">Casa</option>
              <option value="casa_vila">Casa de vila</option>
              <option value="casa_condominio">Casa de condomínio</option>
              <option value="cobertura">Cobertura</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Bairro contém</label>
            <input
              value={f.bairro}
              onChange={(e) => setF({ ...f, bairro: e.target.value })}
              className={inputCls}
              placeholder="Ex.: Ipanema"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setF(FILTROS_VAZIO)}
            className="px-3 py-2 text-sm text-slate-400 hover:text-slate-600"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => onAplicar(f)}
            className="ml-auto px-5 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90"
            style={{ backgroundColor: OLIVE }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  titulo, valor, delta, sufixo, icon: Icon,
}: {
  titulo: string;
  valor: number;
  delta: number | null;
  sufixo?: string;
  icon: React.ElementType;
}) {
  const positivo = delta != null && delta >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {titulo}
        </span>
        <span className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-slate-400" />
        </span>
      </div>
      <p className="text-3xl font-bold text-slate-900 leading-none">{fmt(valor)}</p>
      <div className="flex items-center justify-between mt-3">
        {sufixo && <span className="text-xs text-slate-400">{sufixo}</span>}
        {delta != null ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ml-auto ${
              positivo ? "text-emerald-600" : "text-rose-500"
            }`}
          >
            {positivo ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {positivo ? "+" : ""}{delta.toFixed(1)}%
          </span>
        ) : (
          <span className="text-xs text-slate-300 ml-auto">—</span>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="h-3 w-24 bg-slate-100 rounded mb-4" />
      <div className="h-8 w-20 bg-slate-100 rounded" />
      <div className="h-3 w-16 bg-slate-100 rounded mt-3" />
    </div>
  );
}

// ── Tendência ────────────────────────────────────────────────────────────────
function TendenciaChart({ data, totalVisitantes, delta }: {
  data: DashboardData["serie"]; totalVisitantes: number; delta: number | null;
}) {
  const dados = data.map((d) => ({
    dia: formatDia(d.dia), visitantes: d.visitantes, views: d.views,
  }));
  const positivo = delta != null && delta >= 0;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Tendência
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">Visitantes por dia</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900 leading-none">{fmt(totalVisitantes)}</p>
          {delta != null && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-semibold mt-1 ${
                positivo ? "text-emerald-600" : "text-rose-500"
              }`}
            >
              {positivo ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {positivo ? "+" : ""}{delta.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="h-56">
        {dados.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            Sem dados ainda — comece a divulgar o site para gerar histórico.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gradVisit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 12 }} />
              <Area type="monotone" dataKey="visitantes" stroke={GOLD} strokeWidth={2} fill="url(#gradVisit)" name="Visitantes" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

// ── Funil ────────────────────────────────────────────────────────────────────
function FunilJornada({ funil }: { funil: DashboardData["funil"] }) {
  const etapas = [
    { label: "Visitaram o site", sub: "entraram em alguma página", v: funil.visitaram },
    { label: "Buscaram imóveis", sub: "usaram busca ou filtros", v: funil.buscaram },
    { label: "Abriram um anúncio", sub: "viram a ficha completa", v: funil.abriram },
    { label: "Favoritaram", sub: "sinal claro de interesse", v: funil.favoritaram },
  ];
  const topo = etapas[0].v || 1;
  const interesse = etapas[0].v ? Math.round((etapas[3].v / etapas[0].v) * 100) : 0;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Do clique ao interesse
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">Jornada do visitante</h3>
        </div>
        <p className="text-xs text-slate-500">
          <strong className="text-slate-700">{interesse}%</strong> chegam a demonstrar interesse
        </p>
      </div>
      <ul className="space-y-3">
        {etapas.map((et, i) => {
          const pct = Math.max(2, Math.round((et.v / topo) * 100));
          const drop = i === 0 || etapas[i - 1].v === 0
            ? null
            : Math.round(((et.v - etapas[i - 1].v) / etapas[i - 1].v) * 100);
          return (
            <li key={et.label} className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-300 w-5 flex-shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{et.label}</span>
                  <span className="text-sm font-bold text-slate-900 flex-shrink-0">{fmt(et.v)}</span>
                </div>
                <p className="text-xs text-slate-400">{et.sub}</p>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: i === 3 ? GOLD : OLIVE,
                    }}
                  />
                </div>
              </div>
              {drop != null && (
                <span className="text-xs text-slate-400 w-10 text-right flex-shrink-0">
                  {drop}%
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Origem do tráfego ────────────────────────────────────────────────────────
function OrigemDonut({ origem }: { origem: DashboardData["origem"] }) {
  const total = origem.reduce((s, o) => s + o.total, 0);
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        De onde vêm
      </p>
      <h3 className="font-semibold text-slate-800 mt-0.5 mb-4">Origem do tráfego</h3>

      {origem.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Sem dados ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 items-center">
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={origem} dataKey="total" nameKey="origem"
                  innerRadius={48} outerRadius={70} paddingAngle={2}
                >
                  {origem.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
              <span className="text-xl font-bold text-slate-900">{fmt(total)}</span>
            </div>
          </div>
          <ul className="space-y-1.5 text-xs">
            {origem.map((o, i) => {
              const pct = total ? Math.round((o.total / total) * 100) : 0;
              return (
                <li key={o.origem} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="flex-1 text-slate-700 truncate">{o.origem}</span>
                  <span className="text-slate-400">{pct}%</span>
                  <span className="font-semibold text-slate-900 w-10 text-right">{fmt(o.total)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Top imóveis ──────────────────────────────────────────────────────────────
function TopAnunciosTable({ rows }: { rows: DashboardData["top_imoveis"] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Anúncios em destaque
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">Mais vistos no período</h3>
        </div>
        <Link
          href="/relatorios"
          className="text-xs font-medium flex items-center gap-1 hover:underline"
          style={{ color: OLIVE }}
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-slate-400">Nenhum imóvel visualizado ainda.</p>
      ) : (
        <table className="w-full">
          <thead className="text-[10px] text-slate-400 uppercase tracking-wider">
            <tr className="border-t border-slate-100">
              <th className="text-left px-5 py-2 font-semibold">Imóvel</th>
              <th className="text-right px-3 py-2 font-semibold">Vistas</th>
              <th className="text-right px-3 py-2 font-semibold">Favoritos</th>
              <th className="text-right px-5 py-2 font-semibold">Compart.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.imovel_id} className="border-t border-slate-50">
                <td className="px-5 py-3">
                  <Link
                    href={`/imoveis/${row.imovel_id}`}
                    className="flex items-start gap-2 group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-slate-800 group-hover:underline line-clamp-1">
                        {row.titulo || "(sem título)"}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono">{row.codigo}</span>
                        <span>·</span>
                        <span>{[row.bairro, row.cidade].filter(Boolean).join(", ") || "—"}</span>
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: row.tipo_negocio === "locacao" ? OLIVE : GOLD, color: row.tipo_negocio === "locacao" ? "#fff" : "#3e4037" }}
                        >
                          {row.tipo_negocio === "locacao" ? "Locação" : "Venda"}
                        </span>
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold" style={{ color: OLIVE }}>
                  {fmt(row.total_views)}
                </td>
                <td className="px-3 py-3 text-right text-sm text-slate-700">{fmt(row.favoritos)}</td>
                <td className="px-5 py-3 text-right text-sm text-slate-700">{fmt(row.shares)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Bairros ──────────────────────────────────────────────────────────────────
function BairrosBars({ rows }: { rows: DashboardData["bairros"] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.buscas, r.vistas)));
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Mapa de interesse
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">Bairros mais procurados</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Buscas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GOLD }} /> Vistas
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Sem dados ainda.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.bairro} className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 w-24 truncate">{r.bairro}</span>
              <div className="flex-1 space-y-1">
                <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-300"
                    style={{ width: `${Math.max(2, (r.buscas / max) * 100)}%` }}
                  />
                </div>
                <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${Math.max(2, (r.vistas / max) * 100)}%`, backgroundColor: GOLD }}
                  />
                </div>
              </div>
              <span className="text-[11px] text-slate-400 w-28 text-right flex-shrink-0">
                {fmt(r.buscas)} buscas · {fmt(r.vistas)} vistas
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Dispositivos ─────────────────────────────────────────────────────────────
const DEVICE_ICON: Record<string, React.ElementType> = {
  Celular: Smartphone, Computador: Monitor, Tablet: Tablet,
};

function DispositivoBar({ rows }: { rows: DashboardData["dispositivos"] }) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const ordem = ["Celular", "Computador", "Tablet"];
  const dadosOrd = ordem
    .map((d) => rows.find((r) => r.dispositivo === d) ?? { dispositivo: d, total: 0 })
    .filter((r) => total === 0 || r.total > 0 || ordem.includes(r.dispositivo));
  const cores: Record<string, string> = { Celular: OLIVE, Computador: GOLD, Tablet: "#bfb56a" };
  const mobile = rows.find((r) => r.dispositivo === "Celular")?.total ?? 0;
  const pctMobile = total ? Math.round((mobile / total) * 100) : 0;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Dispositivo
      </p>
      <h3 className="font-semibold text-slate-800 mt-0.5 mb-4">Como acessam o site</h3>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-50 mb-4">
        {dadosOrd.map((d) => {
          const w = total ? (d.total / total) * 100 : 0;
          return w > 0 ? (
            <div key={d.dispositivo} style={{ width: `${w}%`, backgroundColor: cores[d.dispositivo] }} />
          ) : null;
        })}
      </div>

      <ul className="space-y-2 text-sm">
        {dadosOrd.map((d) => {
          const pct = total ? Math.round((d.total / total) * 100) : 0;
          const Icon = DEVICE_ICON[d.dispositivo] ?? Monitor;
          return (
            <li key={d.dispositivo} className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-700">{d.dispositivo}</span>
              <span className="ml-auto font-semibold text-slate-900">{pct}%</span>
            </li>
          );
        })}
      </ul>
      {pctMobile >= 50 && (
        <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          <span className="font-medium text-slate-600">Dica:</span> {pctMobile}% acessam pelo celular —
          vale caprichar nas fotos verticais e na primeira imagem do anúncio.
        </p>
      )}
    </section>
  );
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function HeatmapVisitas({ rows }: { rows: DashboardData["heatmap"] }) {
  // Matriz 7×24
  const matriz: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) matriz[r.dow][r.hora] = r.total;
  const max = Math.max(1, ...rows.map((r) => r.total));
  let pico = { dow: 0, hora: 0, total: 0 };
  for (const r of rows) if (r.total > pico.total) pico = r;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quando visitam
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">Horário × dia da semana</h3>
        </div>
        {pico.total > 0 && (
          <p className="text-[11px] text-slate-400">
            Pico em <strong className="text-slate-700">{DIAS_SEMANA[pico.dow]} · {String(pico.hora).padStart(2, "0")}h</strong>
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="w-9" />
              {[0, 4, 8, 12, 16, 20].map((h) => (
                <th key={h} colSpan={4} className="text-[10px] font-medium text-slate-400 text-left pl-1">
                  {String(h).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIAS_SEMANA.map((dia, dow) => (
              <tr key={dia}>
                <td className="text-[10px] font-semibold text-slate-400 pr-1.5 text-right">{dia}</td>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = matriz[dow][h];
                  const intensidade = v / max;
                  const bg = v === 0
                    ? "#f1f1ea"
                    : `rgba(88, 90, 79, ${0.15 + intensidade * 0.85})`;
                  return (
                    <td key={h}>
                      <div
                        className="w-[14px] h-[14px] sm:w-4 sm:h-4 rounded-sm"
                        style={{ backgroundColor: bg }}
                        title={`${dia} ${String(h).padStart(2, "0")}h — ${v}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-4 justify-end">
        <span>Menos</span>
        {[0.2, 0.4, 0.6, 0.8, 1].map((i) => (
          <div
            key={i}
            className="w-3.5 h-3.5 rounded-sm"
            style={{ backgroundColor: `rgba(88, 90, 79, ${i})` }}
          />
        ))}
        <span>Mais</span>
      </div>
    </section>
  );
}

// ── Termos e buscas vazias ───────────────────────────────────────────────────
function VocabularioVisitante({
  termos, vazias,
}: {
  termos: DashboardData["termos"];
  vazias: DashboardData["buscas_vazias"];
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Vocabulário do visitante
      </p>
      <h3 className="font-semibold text-slate-800 mt-0.5 mb-4">O que estão buscando</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <SearchIcon className="w-3 h-3" /> Termos mais buscados
          </p>
          {termos.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Nenhuma busca por texto livre ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {termos.map((t) => (
                <li key={t.termo} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700 truncate">
                    &ldquo;{t.termo}&rdquo;
                  </span>
                  <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                    {fmt(t.total)}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#a18a3a" }}>
            Buscas sem resultado
          </p>
          {vazias.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">Nenhuma busca sem resultado registrada.</p>
          ) : (
            <ul className="space-y-2">
              {vazias.map((v) => (
                <li key={v.termo} className="bg-amber-50/70 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">&ldquo;{v.termo}&rdquo;</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {fmt(v.pessoas)} {v.pessoas === 1 ? "pessoa procurou" : "pessoas procuraram"} algo que não temos no portfólio
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function AudienciaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30);
  const [filtros, setFiltros] = useState<FiltrosUI>(FILTROS_VAZIO);
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    setErro(false);
    api.get<DashboardData>("/analytics/dashboard", { params: { periodo } })
      .then((r) => setDados(r.data))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [periodo]);

  // Filtros locais aplicados a top_imoveis e bairros.
  const dadosFiltrados = useMemo(() => {
    if (!dados) return null;
    const f = filtros;
    const ativo = Boolean(f.tipo_negocio || f.tipo_imovel || f.bairro);
    if (!ativo) return dados;
    const norm = (s: string) =>
      s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const bairroBusca = f.bairro ? norm(f.bairro) : "";
    return {
      ...dados,
      top_imoveis: dados.top_imoveis.filter((row) => {
        if (f.tipo_negocio && row.tipo_negocio !== f.tipo_negocio) return false;
        if (bairroBusca && !norm(row.bairro ?? "").includes(bairroBusca)) return false;
        return true;
      }),
      bairros: bairroBusca
        ? dados.bairros.filter((r) => norm(r.bairro).includes(bairroBusca))
        : dados.bairros,
    };
  }, [dados, filtros]);

  if (erro) {
    return (
      <div className="space-y-6">
        <Header />
        <RelatoriosTabs />
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
          Não foi possível carregar os dados. Tente novamente em instantes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />
      <RelatoriosTabs />

      <Toolbar
        periodo={periodo}
        onPeriodo={setPeriodo}
        filtros={filtros}
        onFiltros={setFiltros}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {carregando || !dadosFiltrados ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard
              titulo="Visitantes únicos" icon={Users}
              valor={dadosFiltrados.kpis.visitantes_unicos.valor}
              delta={dadosFiltrados.kpis.visitantes_unicos.delta}
              sufixo="pessoas distintas"
            />
            <KpiCard
              titulo="Vistas de anúncio" icon={Building2}
              valor={dadosFiltrados.kpis.vistas_imovel.valor}
              delta={dadosFiltrados.kpis.vistas_imovel.delta}
              sufixo="fichas abertas"
            />
            <KpiCard
              titulo="Buscas realizadas" icon={SearchIcon}
              valor={dadosFiltrados.kpis.buscas.valor}
              delta={dadosFiltrados.kpis.buscas.delta}
              sufixo="usaram busca ou filtros"
            />
            <KpiCard
              titulo="Favoritos" icon={Heart}
              valor={dadosFiltrados.kpis.favoritos.valor}
              delta={dadosFiltrados.kpis.favoritos.delta}
              sufixo="imóveis salvos"
            />
          </>
        )}
      </div>

      {/* Tendência */}
      {dadosFiltrados && (
        <TendenciaChart
          data={dadosFiltrados.serie}
          totalVisitantes={dadosFiltrados.kpis.visitantes_unicos.valor}
          delta={dadosFiltrados.kpis.visitantes_unicos.delta}
        />
      )}

      {/* Jornada + Origem */}
      {dadosFiltrados && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
          <FunilJornada funil={dadosFiltrados.funil} />
          <OrigemDonut origem={dadosFiltrados.origem} />
        </div>
      )}

      {/* Top + Bairros */}
      {dadosFiltrados && (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
          <TopAnunciosTable rows={dadosFiltrados.top_imoveis} />
          <BairrosBars rows={dadosFiltrados.bairros} />
        </div>
      )}

      {/* Dispositivo + Heatmap */}
      {dadosFiltrados && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-3">
          <DispositivoBar rows={dadosFiltrados.dispositivos} />
          <HeatmapVisitas rows={dadosFiltrados.heatmap} />
        </div>
      )}

      {/* Vocabulário */}
      {dadosFiltrados && (
        <VocabularioVisitante
          termos={dadosFiltrados.termos}
          vazias={dadosFiltrados.buscas_vazias}
        />
      )}

      <p className="text-[11px] text-slate-300 text-center pt-2 pb-6">
        Dados dos últimos {labelPeriodo(periodo)} · atualizado em tempo real
      </p>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
      <p className="text-slate-500 text-sm mt-1">
        Quantas pessoas visitaram o site e quais anúncios chamaram mais atenção.
      </p>
    </div>
  );
}
