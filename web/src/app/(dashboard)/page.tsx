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
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface ImovelMaisAntigo {
  codigo: string;
  created_at: string;
}

interface Stats {
  total_imoveis: number;
  imoveis_disponiveis: number;
  imoveis_reservados?: number;
  imoveis_sem_foto?: number;
  total_clientes: number;
  clientes_em_negociacao: number;
  leads_ultimos_7_dias?: number;
  imovel_mais_antigo?: ImovelMaisAntigo | null;
}

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
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    api.get<Stats>("/stats")
      .then((r) => setStats(r.data))
      .catch(() => {
        setStats({} as Stats);
        toast.error("Não foi possível carregar as estatísticas.");
      })
      .finally(() => setLoadingStats(false));
  }, []);

  const v = (n: number | undefined) => String(n ?? 0);
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

        {loadingStats ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-8 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-slate-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                    <div className="h-5 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
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

            {/* Indicadores operacionais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <MiniCard
                label="Sem foto"
                value={v(stats?.imoveis_sem_foto)}
                icon={<ImageOff className="w-4 h-4 text-rose-500" />}
                tone={stats?.imoveis_sem_foto ? "alert" : "neutral"}
                href="/imoveis?sem_foto=1"
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
                href="/clientes?dias=7"
                hint="Clientes cadastrados na última semana"
              />
            </div>
          </>
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
