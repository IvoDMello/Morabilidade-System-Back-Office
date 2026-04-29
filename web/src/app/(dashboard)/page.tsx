"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Users,
  TrendingUp,
  PlusCircle,
  UserPlus,
  Tag,
  Clock,
  ImageOff,
  CalendarPlus,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface ImovelMaisAntigo {
  codigo: string;
  created_at: string;
}

interface ResumoOportunidades {
  total_oportunidades: number;
  clientes_com_preferencia: number;
}

interface Stats {
  total_imoveis: number;
  imoveis_disponiveis: number;
  imoveis_reservados?: number;
  imoveis_sem_foto?: number;
  total_clientes: number;
  clientes_em_negociacao: number;
  leads_ultimos_7_dias?: number;
  clientes_por_status?: Record<string, number>;
  clientes_por_origem?: Record<string, number>;
  imovel_mais_antigo?: ImovelMaisAntigo | null;
}

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  em_negociacao: "Em negociação",
  inativo: "Inativo",
  concluido: "Concluído",
  indefinido: "Sem status",
};

const ORIGEM_LABEL: Record<string, string> = {
  site: "Site",
  indicacao: "Indicação",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  outro: "Outro",
  indefinido: "Sem origem",
};

// Paleta alinhada com a marca olive/gold + tons complementares.
const PALETA = ["#585a4f", "#d8cb6a", "#8b8a72", "#c2b96a", "#a8a78f", "#e3d895", "#6f7163", "#bcb592"];

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function dataFormatada(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardHome() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats | null>(null);
  const [oportunidades, setOportunidades] = useState<ResumoOportunidades | null>(null);

  useEffect(() => {
    api.get<Stats>("/stats").then((r) => setStats(r.data)).catch(() => {});
    api
      .get<ResumoOportunidades>("/oportunidades/resumo")
      .then((r) => setOportunidades(r.data))
      .catch(() => {});
  }, []);

  const v = (n: number | undefined) => (stats == null ? "…" : String(n ?? 0));
  const primeiroNome = user?.nome_completo?.split(" ")[0] ?? "Usuário";

  return (
    <div className="space-y-8">
      {/* Boas-vindas */}
      <div
        className="rounded-2xl px-6 py-7 text-white relative overflow-hidden"
        style={{ backgroundColor: "#585a4f" }}
      >
        {/* Círculos decorativos */}
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
          style={{ backgroundColor: "#d8cb6a" }}
        />
        <div
          className="absolute -bottom-12 -right-4 w-64 h-64 rounded-full opacity-5"
          style={{ backgroundColor: "#d8cb6a" }}
        />

        <div className="relative">
          <p className="text-white/60 text-sm capitalize">{dataFormatada()}</p>
          <h1 className="text-2xl font-bold mt-1">
            {saudacao()}, {primeiroNome}!
          </h1>
          <p className="text-white/70 text-sm mt-1">
            Aqui está o resumo do sistema Morabilidade.
          </p>
          <p
            className="mt-3 text-xs font-semibold tracking-widest uppercase"
            style={{ color: "#d8cb6a" }}
          >
            Simples · Eficiente · Humanizada
          </p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Visão geral
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Imóveis cadastrados"
            value={v(stats?.total_imoveis)}
            icon={<Building2 className="w-5 h-5 text-blue-500" />}
            color="blue"
            href="/imoveis"
          />
          <StatCard
            label="Imóveis disponíveis"
            value={v(stats?.imoveis_disponiveis)}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            color="emerald"
            href="/imoveis?disponibilidade=disponivel"
          />
          <StatCard
            label="Clientes cadastrados"
            value={v(stats?.total_clientes)}
            icon={<Users className="w-5 h-5 text-violet-500" />}
            color="violet"
            href="/clientes"
          />
          <StatCard
            label="Em negociação"
            value={v(stats?.clientes_em_negociacao)}
            icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
            color="amber"
            href="/clientes?status=em_negociacao"
          />
        </div>

        {/* Indicadores operacionais — 2ª linha, alertas e pulso */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <MiniCard
            label="Sem foto"
            value={v(stats?.imoveis_sem_foto)}
            icon={<ImageOff className="w-4 h-4 text-rose-500" />}
            tone={stats?.imoveis_sem_foto ? "alert" : "neutral"}
            href="/imoveis"
            hint="Imóveis publicados sem foto não convertem"
          />
          <MiniCard
            label="Reservados"
            value={v(stats?.imoveis_reservados)}
            icon={<Lock className="w-4 h-4 text-amber-500" />}
            tone="neutral"
            href="/imoveis?disponibilidade=reservado"
            hint="Imóveis em pipeline aguardando fechamento"
          />
          <MiniCard
            label="Leads (7 dias)"
            value={v(stats?.leads_ultimos_7_dias)}
            icon={<CalendarPlus className="w-4 h-4 text-indigo-500" />}
            tone="neutral"
            href="/clientes"
            hint="Clientes cadastrados na última semana"
          />
        </div>

        {oportunidades && oportunidades.total_oportunidades > 0 && (
          <Link
            href="/clientes"
            className="mt-3 flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 transition group"
            title="Ver clientes para acionar pelas preferências"
          >
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <strong className="font-semibold text-amber-900">
                {oportunidades.total_oportunidades} oportunidade
                {oportunidades.total_oportunidades !== 1 ? "s" : ""}
              </strong>{" "}
              de match — {oportunidades.clientes_com_preferencia} cliente
              {oportunidades.clientes_com_preferencia !== 1 ? "s" : ""} com preferência ativa.
              <span className="text-amber-600"> Veja na ficha de cada cliente.</span>
            </p>
          </Link>
        )}

        {stats?.imovel_mais_antigo && (
          <Link
            href={`/imoveis?codigo=${encodeURIComponent(stats.imovel_mais_antigo.codigo)}`}
            className="mt-3 flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition group"
          >
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500">
              Imóvel mais antigo no portfólio:{" "}
              <span className="font-mono font-semibold text-slate-700 group-hover:text-[#585a4f] transition">
                {stats.imovel_mais_antigo.codigo}
              </span>
              <span className="text-slate-400">
                {" "}— cadastrado em {new Date(stats.imovel_mais_antigo.created_at).toLocaleDateString("pt-BR")}
              </span>
            </p>
          </Link>
        )}
      </div>

      {/* Gráficos */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Distribuição de clientes
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Origem dos leads">
            <OrigemChart dados={stats?.clientes_por_origem} />
          </ChartCard>
          <ChartCard title="Clientes por status">
            <StatusChart dados={stats?.clientes_por_status} />
          </ChartCard>
        </div>
      </div>

      {/* Ações rápidas */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Ações rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            href="/imoveis/novo"
            icon={<PlusCircle className="w-5 h-5" />}
            label="Cadastrar imóvel"
            description="Adicione um novo imóvel ao portfólio"
          />
          <QuickAction
            href="/clientes/novo"
            icon={<UserPlus className="w-5 h-5" />}
            label="Cadastrar cliente"
            description="Registre um novo cliente ou lead"
          />
          <QuickAction
            href="/tags"
            icon={<Tag className="w-5 h-5" />}
            label="Gerenciar etiquetas"
            description="Organize os imóveis com etiquetas"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  href,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
    violet: "bg-violet-50",
    amber: "bg-amber-50",
  };
  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start gap-4 hover:shadow-md hover:border-slate-300 transition group"
    >
      <div className={`p-2 rounded-lg flex-shrink-0 ${bg[color]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-1 group-hover:text-[#585a4f] transition">
          {value}
        </p>
      </div>
    </Link>
  );
}

function MiniCard({
  label,
  value,
  icon,
  tone,
  href,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "neutral" | "alert";
  href: string;
  hint: string;
}) {
  const isAlert = tone === "alert";
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border transition group ${
        isAlert
          ? "bg-rose-50/40 border-rose-200 hover:border-rose-300"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
      title={hint}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        <p className={`text-lg font-bold leading-tight mt-0.5 ${isAlert ? "text-rose-700" : "text-slate-800"}`}>
          {value}
        </p>
      </div>
    </Link>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function vazio(dados?: Record<string, number>): boolean {
  if (!dados) return true;
  const valores = Object.values(dados);
  return valores.length === 0 || valores.every((v) => v === 0);
}

function OrigemChart({ dados }: { dados?: Record<string, number> }) {
  if (vazio(dados)) return <ChartEmpty />;
  const data = Object.entries(dados!)
    .map(([k, v]) => ({ nome: ORIGEM_LABEL[k] ?? k, valor: v }))
    .sort((a, b) => b.valor - a.valor);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          formatter={(value) => {
            const n = Number(value);
            return [`${n} cliente${n !== 1 ? "s" : ""}`, ""];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatusChart({ dados }: { dados?: Record<string, number> }) {
  if (vazio(dados)) return <ChartEmpty />;
  const data = Object.entries(dados!)
    .map(([k, v]) => ({ nome: STATUS_LABEL[k] ?? k, valor: v }))
    .sort((a, b) => b.valor - a.valor);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#666" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#666" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(value) => {
            const n = Number(value);
            return [`${n} cliente${n !== 1 ? "s" : ""}`, ""];
          }}
        />
        <Bar dataKey="valor" fill="#585a4f" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      Sem dados ainda
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm hover:border-[#585a4f]/30 transition group"
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white transition group-hover:opacity-90"
        style={{ backgroundColor: "#d8cb6a", color: "#585a4f" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-[#585a4f] transition">
          {label}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
      </div>
    </Link>
  );
}
