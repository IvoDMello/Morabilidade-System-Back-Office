"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Building2, Search as SearchIcon, Heart, Eye,
  TrendingUp, TrendingDown, SlidersHorizontal, X, Smartphone, Monitor, Tablet,
  Clock, ArrowRight, RefreshCw,
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

interface PontoSerie {
  dia: string;
  visitas: number;
  acessos: number;
  mm_visitas: number;
  mm_acessos: number;
  mm_buscas: number;
}

interface DashboardData {
  periodo: number;
  /**
   * Momento da leitura, na hora de Brasília: hoje está contado até aqui.
   * Ausente na API anterior, que pode responder enquanto o deploy novo sobe.
   */
  atualizado_em?: string;
  /** Dias completos do período, terminando ontem (YYYY-MM-DD). */
  inicio: string;
  fim: string;
  /** Primeiro dia com dado dentro da janela consultada (período + anterior). */
  historico_desde: string | null;
  /** Janela dos painéis de detalhe: os eventos brutos só ficam 90 dias. */
  detalhe_dias: number;
  kpis: {
    visitas: KpiValue;
    acessos: KpiValue;
    vistas_imovel: KpiValue;
    buscas: KpiValue;
    favoritos: KpiValue;
  };
  morametrica: {
    visitas: KpiValue;
    acessos: KpiValue;
    buscas: KpiValue;
    sem_resultado: KpiValue;
  };
  /** Dia corrente, até agora; fica fora dos totais do período. */
  hoje: {
    visitas: number;
    acessos: number;
    mm_buscas: number;
  } | null;
  serie: PontoSerie[];
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

/** Uso da MoraMétrica num dia só (/analytics/morametrica/dia). */
interface MoraMetricaDia {
  dia: string;
  /** false no dia de hoje: os números vão até atualizado_em. */
  completo: boolean;
  atualizado_em: string;
  /** null quando o dia é anterior ao histórico. */
  numeros: { visitas: number; acessos: number; buscas: number; sem_resultado: number } | null;
}

/** Lançamento da MoraMétrica: antes disso não há uso para consultar. */
const INICIO_MORAMETRICA = "2026-11-02";

const OLIVE = "#585a4f";
const GOLD = "#d8cb6a";
const PALETTE = [GOLD, OLIVE, "#9a9a82", "#bfb56a", "#3e4037", "#d6d3c4"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function formatData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}
/** "2026-11-04T14:03:10-03:00" → "14:03". A API já manda na hora de Brasília. */
function formatHora(iso: string): string {
  return iso.slice(11, 16);
}
/** "até 14:03", ou "até agora" quando a API não informou a hora da leitura. */
function ateHora(iso: string | null): string {
  return iso ? `até ${formatHora(iso)}` : "até agora";
}
/** Dia seguinte a um "AAAA-MM-DD", sem passar pelo fuso do navegador. */
function diaSeguinte(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
/** "2026-11-03" → "Terça-feira". Meio-dia evita o dia virar no fuso do navegador. */
function diaDaSemana(iso: string): string {
  const nome = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

const CAMPOS_SERIE = ["visitas", "acessos", "mm_visitas", "mm_acessos", "mm_buscas"] as const;

/**
 * 12 meses dia a dia viram 365 picos ilegíveis: agrupa em semanas, de trás
 * para frente para a última ficar completa. Cada ponto é a média por dia da
 * semana, na mesma unidade do gráfico diário, e a semana incompleta do começo
 * não aparece como uma queda.
 */
function mediaSemanal(serie: PontoSerie[]): PontoSerie[] {
  const semanas: PontoSerie[] = [];
  for (let fim = serie.length; fim > 0; fim -= 7) {
    const bloco = serie.slice(Math.max(0, fim - 7), fim);
    const ponto = { dia: bloco[0].dia } as PontoSerie;
    for (const campo of CAMPOS_SERIE) {
      ponto[campo] = Math.round(bloco.reduce((s, p) => s + p[campo], 0) / bloco.length);
    }
    semanas.unshift(ponto);
  }
  return semanas;
}

function Delta({ delta, className = "" }: { delta: number | null; className?: string }) {
  if (delta == null) return null;
  const positivo = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        positivo ? "text-emerald-600" : "text-rose-500"
      } ${className}`}
    >
      {positivo ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positivo ? "+" : ""}{delta.toFixed(1)}%
    </span>
  );
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
  periodo, onPeriodo, filtros, onFiltros, atualizadoEm, atualizando, onAtualizar,
}: {
  periodo: Periodo;
  onPeriodo: (p: Periodo) => void;
  filtros: FiltrosUI;
  onFiltros: (f: FiltrosUI) => void;
  atualizadoEm: string | null;
  atualizando: boolean;
  onAtualizar: () => void;
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
      <div className="ml-auto flex items-center gap-3">
        {atualizadoEm && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Atualizado às {formatHora(atualizadoEm)}</span>
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        )}
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
  titulo, valor, delta, sufixo, icon: Icon, className = "",
}: {
  titulo: string;
  valor: number;
  delta: number | null;
  sufixo?: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>
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
          <Delta delta={delta} className="ml-auto" />
        ) : (
          <span className="text-xs text-slate-300 ml-auto">-</span>
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
function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-slate-400">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: i.cor }} /> {i.rotulo}
        </span>
      ))}
    </div>
  );
}

/** Duas séries em área: a de baixo, mais escura e discreta; a de cima, dourada. */
function GraficoDuplo({ dados, fundo, frente, idGradiente }: {
  dados: PontoSerie[];
  fundo: { chave: keyof PontoSerie; nome: string };
  frente: { chave: keyof PontoSerie; nome: string };
  idGradiente: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={dados.map((d) => ({ ...d, rotulo: formatDia(d.dia) }))}
        margin={{ top: 4, right: 12, bottom: 0, left: -20 }}
      >
        <defs>
          <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 12 }} />
        <Area type="monotone" dataKey={fundo.chave} stroke={OLIVE} strokeWidth={1.5} fill={OLIVE} fillOpacity={0.08} name={fundo.nome} />
        <Area type="monotone" dataKey={frente.chave} stroke={GOLD} strokeWidth={2} fill={`url(#${idGradiente})`} name={frente.nome} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TendenciaChart({ serie, semanal, visitas, acessos, hoje, atualizadoEm }: {
  serie: PontoSerie[];
  semanal: boolean;
  visitas: KpiValue;
  acessos: KpiValue;
  hoje: DashboardData["hoje"];
  atualizadoEm: string | null;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between mb-4 gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Tendência
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">
            Visitas e acessos por dia{semanal && " (média de cada semana)"}
          </h3>
          {hoje && (
            <p className="text-xs text-slate-400 mt-1">
              Hoje, {ateHora(atualizadoEm)}: {fmt(hoje.visitas)} visitas e {fmt(hoje.acessos)} acessos
            </p>
          )}
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-none">{fmt(visitas.valor)}</p>
            <p className="text-[11px] text-slate-400 mt-1">visitas</p>
            <Delta delta={visitas.delta} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-none">{fmt(acessos.valor)}</p>
            <p className="text-[11px] text-slate-400 mt-1">acessos</p>
            <Delta delta={acessos.delta} />
          </div>
        </div>
      </div>
      <div className="flex justify-end mb-2">
        <Legenda itens={[{ cor: GOLD, rotulo: "Visitas" }, { cor: OLIVE, rotulo: "Acessos" }]} />
      </div>
      <div className="h-56">
        {serie.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            Sem dados ainda, comece a divulgar o site para gerar histórico.
          </div>
        ) : (
          <GraficoDuplo
            dados={semanal ? mediaSemanal(serie) : serie}
            fundo={{ chave: "acessos", nome: "Acessos" }}
            frente={{ chave: "visitas", nome: "Visitas" }}
            idGradiente="gradVisit"
          />
        )}
      </div>
    </section>
  );
}

// ── MoraMétrica ──────────────────────────────────────────────────────────────
function NumeroMoraMetrica({ titulo, sufixo, kpi }: { titulo: string; sufixo: string; kpi: KpiValue }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{titulo}</p>
      <p className="text-2xl font-bold text-slate-900 leading-none mt-2">{fmt(kpi.valor)}</p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-slate-400">{sufixo}</span>
        <Delta delta={kpi.delta} />
      </div>
    </div>
  );
}

function CardsMoraMetrica({ buscas, sem_resultado, visitas, acessos }: DashboardData["morametrica"]) {
  const pctSemResultado = buscas.valor ? Math.round((sem_resultado.valor / buscas.valor) * 100) : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <NumeroMoraMetrica
        titulo="Buscas" kpi={buscas}
        sufixo={buscas.valor ? `${pctSemResultado}% sem resultado` : "endereços consultados"}
      />
      <NumeroMoraMetrica titulo="Visitas" kpi={visitas} sufixo="sessões que abriram" />
      <NumeroMoraMetrica titulo="Acessos" kpi={acessos} sufixo="aberturas da página" />
    </div>
  );
}

function CardsMoraMetricaSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-slate-50 px-4 py-3">
          <div className="h-3 w-16 bg-slate-100 rounded" />
          <div className="h-6 w-20 bg-slate-100 rounded mt-3" />
          <div className="h-3 w-24 bg-slate-100 rounded mt-3" />
        </div>
      ))}
    </div>
  );
}

type ModoMoraMetrica = "periodo" | "dia";

const MODOS_MORAMETRICA: { v: ModoMoraMetrica; label: string }[] = [
  { v: "periodo", label: "Período" },
  { v: "dia", label: "Por dia" },
];

/** Os números de um dia escolhido no calendário, de /analytics/morametrica/dia. */
function MoraMetricaDoDia({ dia, hoje, recarga }: { dia: string; hoje: string; recarga: number }) {
  const [doDia, setDoDia] = useState<MoraMetricaDia | null>(null);
  const [erro, setErro] = useState(false);
  const valido = dia >= INICIO_MORAMETRICA && dia <= hoje;

  useEffect(() => {
    if (!valido) return;
    let ativo = true;
    setDoDia(null);
    setErro(false);
    api.get<MoraMetricaDia>("/analytics/morametrica/dia", { params: { dia } })
      .then((r) => { if (ativo) setDoDia(r.data); })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [dia, valido, recarga]);

  const aviso = (texto: string) => (
    <p className="text-sm text-slate-400 text-center py-8">{texto}</p>
  );

  if (!valido) {
    return aviso(`Escolha um dia entre ${formatData(INICIO_MORAMETRICA)}, quando a MoraMétrica entrou no ar, e hoje.`);
  }
  if (erro) return aviso("Não foi possível carregar este dia. Tente de novo em instantes.");
  if (!doDia || doDia.dia !== dia) {
    return (
      <>
        <p className="text-xs text-slate-400 mb-3">Carregando {formatData(dia)}…</p>
        <CardsMoraMetricaSkeleton />
      </>
    );
  }
  if (!doDia.numeros) return aviso("Não há registro deste dia.");

  const n = doDia.numeros;
  const kpi = (valor: number): KpiValue => ({ valor, delta: null });
  return (
    <>
      <p className="text-xs text-slate-400 mb-3">
        {doDia.completo
          ? `${diaDaSemana(dia)}, ${formatData(dia)}: dia completo, da 0h à meia-noite.`
          : `Hoje, até ${formatHora(doDia.atualizado_em)}. O dia ainda não terminou.`}
      </p>
      <CardsMoraMetrica
        buscas={kpi(n.buscas)} sem_resultado={kpi(n.sem_resultado)}
        visitas={kpi(n.visitas)} acessos={kpi(n.acessos)}
      />
    </>
  );
}

function MoraMetricaSecao({ dados, serie, semanal, hoje, inicio, fim, atualizadoEm, recarga }: {
  dados: DashboardData["morametrica"];
  serie: PontoSerie[];
  semanal: boolean;
  hoje: DashboardData["hoje"];
  inicio: string;
  fim: string;
  atualizadoEm: string | null;
  recarga: number;
}) {
  const [modo, setModo] = useState<ModoMoraMetrica>("periodo");
  // Abre no último dia completo
  const [dia, setDia] = useState(fim);
  // fim é ontem: sem a hora da leitura, hoje é o dia seguinte a ele
  const dataHoje = atualizadoEm ? atualizadoEm.slice(0, 10) : diaSeguinte(fim);

  // O gráfico começa no primeiro dia com uso: antes disso a MoraMétrica não existia
  const primeiro = serie.findIndex((p) => p.mm_acessos > 0 || p.mm_buscas > 0);
  const comUso = primeiro === -1 ? [] : serie.slice(primeiro);
  const desde = inicio > INICIO_MORAMETRICA ? inicio : INICIO_MORAMETRICA;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Vendas registradas no Rio
          </p>
          <h3 className="font-semibold text-slate-800 mt-0.5">Uso da MoraMétrica</h3>
        </div>
        {modo === "periodo" && (
          <Legenda itens={[{ cor: GOLD, rotulo: "Buscas" }, { cor: OLIVE, rotulo: "Visitas" }]} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1 bg-slate-50 rounded-full p-1">
          {MODOS_MORAMETRICA.map((m) => (
            <button
              key={m.v}
              type="button"
              aria-pressed={modo === m.v}
              onClick={() => setModo(m.v)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                modo === m.v ? "text-white" : "text-slate-500 hover:text-slate-700"
              }`}
              style={modo === m.v ? { backgroundColor: "#1f2120" } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>
        {modo === "dia" && (
          <input
            type="date"
            aria-label="Dia"
            value={dia}
            min={INICIO_MORAMETRICA}
            max={dataHoje}
            onChange={(e) => setDia(e.target.value)}
            className="text-xs border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 focus:outline-none focus:border-[#585a4f]"
          />
        )}
      </div>

      {modo === "dia" ? (
        <MoraMetricaDoDia dia={dia} hoje={dataHoje} recarga={recarga} />
      ) : (
        <>
          <div className="text-xs text-slate-400 mb-4 space-y-0.5">
            {desde <= fim && (
              <p>De {formatData(desde)} a {formatData(fim)}, dias completos.</p>
            )}
            {hoje && (
              <p>
                Hoje, {ateHora(atualizadoEm)}: {fmt(hoje.mm_buscas)}{" "}
                {hoje.mm_buscas === 1 ? "busca" : "buscas"}
              </p>
            )}
          </div>

          <CardsMoraMetrica {...dados} />

          <div className="h-48 mt-4">
            {comUso.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Nenhum uso da MoraMétrica no período.
              </div>
            ) : (
              <GraficoDuplo
                dados={semanal ? mediaSemanal(comUso) : comUso}
                fundo={{ chave: "mm_visitas", nome: "Visitas" }}
                frente={{ chave: "mm_buscas", nome: "Buscas" }}
                idGradiente="gradMoraMetrica"
              />
            )}
          </div>
        </>
      )}
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
      <h3 className="font-semibold text-slate-800 mt-0.5 mb-4">Origem das visitas</h3>

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
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Visitas</span>
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
                        <span>{[row.bairro, row.cidade].filter(Boolean).join(", ") || "-"}</span>
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
          <span className="font-medium text-slate-600">Dica:</span> {pctMobile}% acessam pelo celular
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
                        title={`${dia} ${String(h).padStart(2, "0")}h, ${v}`}
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
  // Cada clique em "Atualizar" relê o painel (e o dia aberto na MoraMétrica)
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    setCarregando(true);
    setErro(false);
    api.get<DashboardData>("/analytics/dashboard", { params: { periodo } })
      .then((r) => setDados(r.data))
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, [periodo, recarga]);

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
        atualizadoEm={dados?.atualizado_em ?? null}
        atualizando={carregando}
        onAtualizar={() => setRecarga((n) => n + 1)}
      />

      {dados?.historico_desde && dados.historico_desde > dados.inicio && (
        <p className="text-xs text-slate-500 bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-2.5">
          O histórico começa em {formatData(dados.historico_desde)}: o período mostra os dias a
          partir daí, e não há período anterior completo para comparar.
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {carregando || !dadosFiltrados ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard
              titulo="Visitas" icon={Users}
              valor={dadosFiltrados.kpis.visitas.valor}
              delta={dadosFiltrados.kpis.visitas.delta}
              sufixo="sessões no site"
              className="col-span-2 lg:col-span-1"
            />
            <KpiCard
              titulo="Acessos" icon={Eye}
              valor={dadosFiltrados.kpis.acessos.valor}
              delta={dadosFiltrados.kpis.acessos.delta}
              sufixo="páginas vistas"
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
          serie={dadosFiltrados.serie}
          semanal={periodo === 365}
          visitas={dadosFiltrados.kpis.visitas}
          acessos={dadosFiltrados.kpis.acessos}
          hoje={dadosFiltrados.hoje}
          atualizadoEm={dadosFiltrados.atualizado_em ?? null}
        />
      )}

      {/* MoraMétrica */}
      {dadosFiltrados && (
        <MoraMetricaSecao
          dados={dadosFiltrados.morametrica}
          serie={dadosFiltrados.serie}
          semanal={periodo === 365}
          hoje={dadosFiltrados.hoje}
          inicio={dadosFiltrados.inicio}
          fim={dadosFiltrados.fim}
          atualizadoEm={dadosFiltrados.atualizado_em ?? null}
          recarga={recarga}
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

      {dados && (
        <div className="text-[11px] text-slate-400 text-center pt-2 pb-6 space-y-1">
          <p>
            Números do período: {formatData(dados.inicio)} a {formatData(dados.fim)}, dias
            completos, comparados aos {dados.periodo} dias anteriores. Hoje aparece à parte,
            contado {ateHora(dados.atualizado_em ?? null)}.
          </p>
          <p>
            Cada visita e busca entra na hora em que acontece. O painel lê tudo quando a página
            abre: para ver os números mais novos, use Atualizar.
          </p>
          <p>
            Visita é uma sessão: a mesma pessoa conta de novo em outro dia ou em outra aba.
            Acesso é cada página vista.
          </p>
          <p>
            Busca na MoraMétrica é cada endereço consultado, inclusive os abertos a partir de
            outro resultado (uma rua e depois um prédio dela).
          </p>
          <p>
            Jornada, anúncios, bairros, dispositivo, horários e buscas: últimos {dados.detalhe_dias} dias,
            que é o quanto o detalhe fica guardado.
          </p>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
      <p className="text-slate-500 text-sm mt-1">
        Quantas visitas o site recebeu, o uso da MoraMétrica e quais anúncios chamaram mais atenção.
      </p>
    </div>
  );
}
