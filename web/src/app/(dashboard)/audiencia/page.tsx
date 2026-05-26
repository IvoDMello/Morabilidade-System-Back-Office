"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Users, Building2, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";

interface Janela {
  total_views: number;
  sessoes_unicas: number;
  views_imovel: number;
}

interface TopImovel {
  imovel_id: string;
  codigo: string;
  titulo: string | null;
  bairro: string | null;
  cidade: string | null;
  total_views: number;
  sessoes_unicas: number;
}

interface SerieDia {
  dia: string;
  total_views: number;
  sessoes_unicas: number;
}

interface ResumoAnalytics {
  ultimos_7_dias: Janela;
  ultimos_30_dias: Janela;
  top_imoveis_30d: TopImovel[];
  serie_diaria_30d: SerieDia[];
}

function formatDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function Card({
  titulo, valor, subvalor, icon: Icon,
}: { titulo: string; valor: number; subvalor?: string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {titulo}
        </span>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{valor.toLocaleString("pt-BR")}</p>
      {subvalor && <p className="text-xs text-slate-400 mt-1">{subvalor}</p>}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
      <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
      <div className="h-7 w-16 bg-slate-100 rounded" />
    </div>
  );
}

export default function AudienciaPage() {
  const [dados, setDados] = useState<ResumoAnalytics | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get<ResumoAnalytics>("/analytics/resumo")
      .then((r) => setDados(r.data))
      .catch(() => setErro(true));
  }, []);

  if (erro) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Não foi possível carregar a audiência. Tente novamente mais tarde.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audiência</h1>
        <p className="text-slate-500 text-sm mt-1">
          Quantas pessoas visitaram o site e quais anúncios chamaram mais atenção.
        </p>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Últimos 7 dias
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {dados ? (
            <>
              <Card
                titulo="Visitantes únicos"
                valor={dados.ultimos_7_dias.sessoes_unicas}
                icon={Users}
                subvalor="sessões distintas"
              />
              <Card
                titulo="Páginas vistas"
                valor={dados.ultimos_7_dias.total_views}
                icon={Eye}
              />
              <Card
                titulo="Vistas de anúncio"
                valor={dados.ultimos_7_dias.views_imovel}
                icon={Building2}
              />
            </>
          ) : (
            <>
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Últimos 30 dias
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {dados ? (
            <>
              <Card
                titulo="Visitantes únicos"
                valor={dados.ultimos_30_dias.sessoes_unicas}
                icon={Users}
                subvalor="sessões distintas"
              />
              <Card
                titulo="Páginas vistas"
                valor={dados.ultimos_30_dias.total_views}
                icon={Eye}
              />
              <Card
                titulo="Vistas de anúncio"
                valor={dados.ultimos_30_dias.views_imovel}
                icon={Building2}
              />
            </>
          ) : (
            <>
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Tendência diária — últimos 30 dias
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="h-64">
            {dados ? (
              dados.serie_diaria_30d.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Sem dados ainda — comece a divulgar o site para gerar histórico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dados.serie_diaria_30d.map((d) => ({
                      dia: formatDia(d.dia),
                      visitantes: d.sessoes_unicas,
                      views: d.total_views,
                    }))}
                    margin={{ top: 4, right: 16, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
                    />
                    <Line type="monotone" dataKey="visitantes" stroke="#585a4f" strokeWidth={2} dot={false} name="Visitantes" />
                    <Line type="monotone" dataKey="views" stroke="#d8cb6a" strokeWidth={2} dot={false} name="Páginas vistas" />
                  </LineChart>
                </ResponsiveContainer>
              )
            ) : (
              <div className="h-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-slate-200 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Top 10 anúncios mais vistos — últimos 30 dias
        </h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {dados ? (
            dados.top_imoveis_30d.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Nenhum imóvel visualizado ainda nos últimos 30 dias.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Código</th>
                    <th className="text-left px-4 py-2.5 font-medium">Imóvel</th>
                    <th className="text-right px-4 py-2.5 font-medium">Visitantes</th>
                    <th className="text-right px-4 py-2.5 font-medium">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.top_imoveis_30d.map((row, i) => (
                    <tr key={row.imovel_id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                        <Link
                          href={`/imoveis/${row.imovel_id}`}
                          className="hover:underline"
                          style={{ color: "#585a4f" }}
                        >
                          {row.codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-slate-800">
                        <p className="line-clamp-1">{row.titulo || "(sem título)"}</p>
                        <p className="text-xs text-slate-400">
                          {[row.bairro, row.cidade].filter(Boolean).join(", ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-700">
                        {row.sessoes_unicas.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-semibold" style={{ color: "#585a4f" }}>
                        {row.total_views.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div className="p-8 space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-50 rounded" />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
