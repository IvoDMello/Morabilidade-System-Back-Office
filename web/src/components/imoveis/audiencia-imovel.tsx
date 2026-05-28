"use client";

import { useEffect, useState } from "react";
import { Eye, Users } from "lucide-react";
import { api } from "@/lib/api";

interface AudienciaImovel {
  total_views: number;
  views_30d: number;
  views_7d: number;
  sessoes_unicas_30d: number;
}

interface Props {
  codigo: string;
}

export function AudienciaImovel({ codigo }: Props) {
  const [dados, setDados] = useState<AudienciaImovel | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api
      .get<AudienciaImovel>(`/analytics/imovel/${codigo}`)
      .then((r) => setDados(r.data))
      .catch(() => setErro(true));
  }, [codigo]);

  // Falha silenciosa: a página principal continua funcionando se o endpoint
  // estiver fora do ar. Audiência é informação periférica, não bloqueante.
  if (erro) return null;

  if (!dados) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 animate-pulse">
        <div className="h-3 w-32 bg-slate-100 rounded mb-3" />
        <div className="h-5 w-48 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Audiência no site
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Stat label="Total" valor={dados.total_views} destaque />
        <Stat label="Últimos 30 dias" valor={dados.views_30d} />
        <Stat label="Últimos 7 dias" valor={dados.views_7d} />
        <Stat
          label="Visitantes únicos (30d)"
          valor={dados.sessoes_unicas_30d}
          icon={Users}
        />
      </div>
    </div>
  );
}

function Stat({
  label, valor, destaque, icon: Icon,
}: { label: string; valor: number; destaque?: boolean; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
      <span className="text-xs text-slate-500">{label}:</span>
      <span
        className={destaque ? "font-bold text-slate-900" : "font-semibold text-slate-700"}
        style={destaque ? { color: "#585a4f" } : undefined}
      >
        {(valor ?? 0).toLocaleString("pt-BR")}
      </span>
    </div>
  );
}
