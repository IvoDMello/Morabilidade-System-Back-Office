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
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface Stats {
  total_imoveis: number;
  imoveis_disponiveis: number;
  total_clientes: number;
  clientes_em_negociacao: number;
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

  useEffect(() => {
    api.get<Stats>("/stats").then((r) => setStats(r.data)).catch(() => {});
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
