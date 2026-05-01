"use client";

import { useEffect, useState } from "react";
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
} from "recharts";
import { api } from "@/lib/api";

interface RelatoriosData {
  meses_labels: string[];
  imoveis_por_mes: Record<string, number>;
  imoveis_por_tipo: Record<string, number>;
  imoveis_por_tipo_negocio: Record<string, number>;
  imoveis_por_disponibilidade: Record<string, number>;
  top_bairros: Record<string, number>;
  preco_medio_por_tipo: Record<string, number>;
  clientes_por_mes: Record<string, number>;
}

const PALETA = ["#585a4f", "#d8cb6a", "#8b8a72", "#c2b96a", "#a8a78f", "#e3d895", "#6f7163", "#bcb592"];

const TIPO_IMOVEL_LABEL: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
  sala: "Sala Comercial",
  galpao: "Galpão",
  loja: "Loja",
  cobertura: "Cobertura",
  kitnet: "Kitnet",
  outro: "Outro",
};

const TIPO_NEGOCIO_LABEL: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Venda + Loc.",
  indefinido: "Indefinido",
};

const DISPONIBILIDADE_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido_locado: "Vendido/Locado",
  indefinido: "Indefinido",
};

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatMes(ym: string): string {
  const [year, month] = ym.split("-");
  return `${MESES_PT[parseInt(month) - 1]}/${year.slice(2)}`;
}

function formatValorAbrev(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v}`;
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      Sem dados ainda
    </div>
  );
}

function ImoveisPorMesChart({ meses, dados }: { meses: string[]; dados: Record<string, number> }) {
  const data = meses.map((m) => ({ mes: formatMes(m), total: dados[m] ?? 0 }));
  const temDados = data.some((d) => d.total > 0);
  if (!temDados) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(v) => [`${v} imóvel${Number(v) !== 1 ? "is" : ""}`, ""]}
        />
        <Bar dataKey="total" fill="#585a4f" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ClientesPorMesChart({ meses, dados }: { meses: string[]; dados: Record<string, number> }) {
  const data = meses.map((m) => ({ mes: formatMes(m), total: dados[m] ?? 0 }));
  const temDados = data.some((d) => d.total > 0);
  if (!temDados) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(v) => [`${v} cliente${Number(v) !== 1 ? "s" : ""}`, ""]}
        />
        <Bar dataKey="total" fill="#d8cb6a" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TipoImovelChart({ dados }: { dados: Record<string, number> }) {
  const data = Object.entries(dados)
    .map(([k, v]) => ({ nome: TIPO_IMOVEL_LABEL[k] ?? k, valor: v }))
    .sort((a, b) => b.valor - a.valor);
  if (data.length === 0 || data.every((d) => d.valor === 0)) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          cx="50%"
          cy="46%"
          innerRadius={48}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          formatter={(v) => [`${v} imóvel${Number(v) !== 1 ? "is" : ""}`, ""]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TipoNegocioChart({ dados }: { dados: Record<string, number> }) {
  const data = Object.entries(dados)
    .map(([k, v]) => ({ nome: TIPO_NEGOCIO_LABEL[k] ?? k, total: v }))
    .sort((a, b) => b.total - a.total);
  if (data.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(v) => [`${v} imóvel${Number(v) !== 1 ? "is" : ""}`, ""]}
        />
        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DisponibilidadeChart({ dados }: { dados: Record<string, number> }) {
  const data = Object.entries(dados)
    .map(([k, v]) => ({ nome: DISPONIBILIDADE_LABEL[k] ?? k, total: v }))
    .sort((a, b) => b.total - a.total);
  if (data.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(v) => [`${v} imóvel${Number(v) !== 1 ? "is" : ""}`, ""]}
        />
        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETA[i % PALETA.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopBairrosChart({ dados }: { dados: Record<string, number> }) {
  const data = Object.entries(dados)
    .map(([k, v]) => ({ bairro: k, total: v }))
    .sort((a, b) => b.total - a.total);
  if (data.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="bairro"
          width={110}
          tick={{ fontSize: 11, fill: "#555" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(v) => [`${v} imóvel${Number(v) !== 1 ? "is" : ""}`, ""]}
        />
        <Bar dataKey="total" fill="#d8cb6a" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PrecoMedioChart({ dados }: { dados: Record<string, number> }) {
  const data = Object.entries(dados)
    .map(([k, v]) => ({ nome: TIPO_IMOVEL_LABEL[k] ?? k, valor: v }))
    .sort((a, b) => b.valor - a.valor);
  if (data.length === 0) return <ChartEmpty />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0e8" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={formatValorAbrev}
          tick={{ fontSize: 10, fill: "#888" }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e6e6dd", fontSize: 13 }}
          cursor={{ fill: "#f5f5f0" }}
          formatter={(v) => [formatCurrency(Number(v)), "Ticket médio"]}
        />
        <Bar dataKey="valor" fill="#8b8a72" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function RelatoriosPage() {
  const [dados, setDados] = useState<RelatoriosData | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get<RelatoriosData>("/relatorios")
      .then((r) => setDados(r.data))
      .catch(() => setErro(true));
  }, []);

  if (erro) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Não foi possível carregar os relatórios. Tente novamente mais tarde.
      </div>
    );
  }

  const meses = dados?.meses_labels ?? [];
  const temPrecoMedio = dados && Object.keys(dados.preco_medio_por_tipo).length > 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
        <p className="text-slate-500 text-sm mt-1">
          Visão analítica do portfólio e da carteira de clientes.
        </p>
      </div>

      {/* Seção: Imóveis ao longo do tempo */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Evolução do portfólio — últimos 12 meses
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Imóveis cadastrados por mês">
            <div className="h-56">
              {dados ? (
                <ImoveisPorMesChart meses={meses} dados={dados.imoveis_por_mes} />
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </ChartCard>
          <ChartCard title="Clientes cadastrados por mês">
            <div className="h-56">
              {dados ? (
                <ClientesPorMesChart meses={meses} dados={dados.clientes_por_mes} />
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </ChartCard>
        </div>
      </section>

      {/* Seção: Mix do portfólio */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Composição do portfólio
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Tipo de imóvel">
            <div className="h-56">
              {dados ? (
                <TipoImovelChart dados={dados.imoveis_por_tipo} />
              ) : (
                <ChartSkeleton />
              )}
            </div>
            {dados && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(dados.imoveis_por_tipo)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v], i) => (
                    <span key={k} className="flex items-center gap-1 text-xs text-slate-600">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PALETA[i % PALETA.length] }}
                      />
                      {TIPO_IMOVEL_LABEL[k] ?? k} ({v})
                    </span>
                  ))}
              </div>
            )}
          </ChartCard>
          <ChartCard title="Tipo de negócio">
            <div className="h-56">
              {dados ? (
                <TipoNegocioChart dados={dados.imoveis_por_tipo_negocio} />
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </ChartCard>
          <ChartCard title="Por disponibilidade">
            <div className="h-56">
              {dados ? (
                <DisponibilidadeChart dados={dados.imoveis_por_disponibilidade} />
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </ChartCard>
        </div>
      </section>

      {/* Seção: Geografia */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Geografia
        </h2>
        <ChartCard title="Imóveis por bairro — top 10">
          <div className="h-72">
            {dados ? (
              <TopBairrosChart dados={dados.top_bairros} />
            ) : (
              <ChartSkeleton />
            )}
          </div>
        </ChartCard>
      </section>

      {/* Seção: Análise de preços (condicional) */}
      {(dados === null || temPrecoMedio) && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Análise de preços
          </h2>
          <ChartCard title="Ticket médio de venda por tipo de imóvel">
            <div className="h-64">
              {dados ? (
                <PrecoMedioChart dados={dados.preco_medio_por_tipo} />
              ) : (
                <ChartSkeleton />
              )}
            </div>
          </ChartCard>
        </section>
      )}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-full flex items-end gap-2 pb-2 px-2 animate-pulse">
      {[40, 70, 55, 90, 60, 75, 45, 85, 65, 50, 80, 35].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-slate-100"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
