"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Users, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

interface Stats {
  total_imoveis: number;
  imoveis_disponiveis: number;
  total_clientes: number;
  clientes_em_negociacao: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const v = (n: number | undefined) => (stats == null ? "…" : String(n ?? 0));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Painel</h1>
      <p className="text-slate-500 text-sm mb-6">Bem-vindo ao sistema de gestão Morabilidade.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Imóveis cadastrados"
          value={v(stats?.total_imoveis)}
          icon={<Building2 className="w-5 h-5 text-blue-500" />}
          color="blue"
        />
        <StatCard
          label="Imóveis disponíveis"
          value={v(stats?.imoveis_disponiveis)}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          color="emerald"
        />
        <StatCard
          label="Clientes cadastrados"
          value={v(stats?.total_clientes)}
          icon={<Users className="w-5 h-5 text-violet-500" />}
          color="violet"
        />
        <StatCard
          label="Em negociação"
          value={v(stats?.clientes_em_negociacao)}
          icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
          color="amber"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50",
    emerald: "bg-emerald-50",
    violet: "bg-violet-50",
    amber: "bg-amber-50",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-start gap-4">
      <div className={`p-2 rounded-lg ${bg[color]}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
      </div>
    </div>
  );
}
