"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Building2,
  AlertTriangle,
  Loader2,
  Filter,
  Users,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatarMoeda } from "@/lib/utils";

const SCORE_MAX = 6;

const FILTER_OPTIONS = [
  { label: "Todos", minScore: 0 },
  { label: "≥ 50%", minScore: 3 },
  { label: "≥ 67%", minScore: 4 },
  { label: "≥ 75%", minScore: 5 },
  { label: "100%", minScore: 6 },
];

const TIPO_IMOVEL_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  cobertura: "Cobertura",
  casa: "Casa",
  kitnet: "Kitnet",
  terreno: "Terreno",
  sala: "Sala",
  galpao: "Galpão",
  loja: "Loja",
  outro: "Outro",
};

const TIPO_NEGOCIO_LABEL: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Venda/Locação",
};

interface ClienteItem {
  id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
}

interface Match {
  imovel_id: string;
  codigo: string;
  cidade: string;
  bairro: string;
  tipo_imovel: string;
  tipo_negocio: string;
  valor_venda?: number;
  valor_locacao?: number;
  dormitorios?: number;
  foto_capa?: string;
  score: number;
}

interface Preferencia {
  tipo_negocio?: string | null;
  tipo_imovel?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  valor_min?: number | null;
  valor_max?: number | null;
  dormitorios_min?: number | null;
  observacoes?: string | null;
}

function getOutFields(m: Match, p: Preferencia): string[] {
  const out: string[] = [];
  const valor = m.tipo_negocio === "locacao" ? m.valor_locacao : m.valor_venda;

  if (p.tipo_negocio && p.tipo_negocio !== "ambos" && m.tipo_negocio !== p.tipo_negocio)
    out.push("Tipo de negócio");
  if (p.tipo_imovel && m.tipo_imovel !== p.tipo_imovel)
    out.push("Tipo de imóvel");
  if (p.cidade?.trim() && !m.cidade?.toLowerCase().includes(p.cidade.toLowerCase().trim()))
    out.push("Cidade");
  if (p.bairro?.trim() && !m.bairro?.toLowerCase().includes(p.bairro.toLowerCase().trim()))
    out.push("Bairro");
  if (p.dormitorios_min && (m.dormitorios ?? 0) < p.dormitorios_min)
    out.push(`Dormitórios (${m.dormitorios ?? 0} < mín. ${p.dormitorios_min})`);
  if (valor != null && p.valor_min != null && valor < p.valor_min)
    out.push("Valor abaixo do mínimo");
  if (valor != null && p.valor_max != null && valor > p.valor_max)
    out.push("Valor acima do máximo");

  return out;
}

function whatsappLink(telefone: string, codigo: string, bairro: string) {
  const numero = telefone.replace(/\D/g, "");
  const msg = `Olá! Apareceu um imóvel na Morabilidade que combina com o que você procura: código *${codigo}* em ${bairro}. Posso te mandar mais detalhes?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

function scorePercent(score: number) {
  return Math.round((score / SCORE_MAX) * 100);
}

export default function OportunidadesPage() {
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [matchesMap, setMatchesMap] = useState<Record<string, Match[]>>({});
  const [prefMap, setPrefMap] = useState<Record<string, Preferencia | null>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [minScore, setMinScore] = useState(5);

  useEffect(() => {
    async function load() {
      setLoadingClientes(true);
      try {
        const r = await api.get<ClienteItem[]>("/clientes/", {
          params: { status: "ativo", page_size: 100 },
        });
        const lista = r.data;
        setClientes(lista);
        setLoadingClientes(false);

        const BATCH = 10;
        for (let i = 0; i < lista.length; i += BATCH) {
          const batch = lista.slice(i, i + BATCH);
          await Promise.all(
            batch.map((c) =>
              api
                .get<Match[]>(`/clientes/${c.id}/matches`)
                .then((mr) =>
                  setMatchesMap((prev) => ({ ...prev, [c.id]: mr.data }))
                )
                .catch(() =>
                  setMatchesMap((prev) => ({ ...prev, [c.id]: [] }))
                )
            )
          );
        }
      } catch {
        setClientes([]);
        setLoadingClientes(false);
      } finally {
        setMatchesLoaded(true);
      }
    }
    load();
  }, []);

  const toggleExpand = useCallback(
    async (clienteId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(clienteId)) next.delete(clienteId);
        else next.add(clienteId);
        return next;
      });

      if (!Object.prototype.hasOwnProperty.call(prefMap, clienteId)) {
        try {
          const r = await api.get<Preferencia>(
            `/clientes/${clienteId}/preferencia`
          );
          setPrefMap((prev) => ({ ...prev, [clienteId]: r.data }));
        } catch {
          setPrefMap((prev) => ({ ...prev, [clienteId]: null }));
        }
      }
    },
    [prefMap]
  );

  const clientesComMatches = clientes.filter((c) => {
    const matches = matchesMap[c.id];
    return Array.isArray(matches) && matches.some((m) => m.score >= minScore);
  });

  const totalMatches = clientesComMatches.reduce((acc, c) => {
    return acc + (matchesMap[c.id] ?? []).filter((m) => m.score >= minScore).length;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Oportunidades</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Clientes ativos cujas preferências combinam com imóveis do portfólio
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Correspondência mínima:
          </span>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f]"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.minScore} value={o.minScore}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legenda */}
      <LegendCard />

      {/* Estado de carregamento — clientes */}
      {loadingClientes && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-400">
            Carregando clientes…
          </span>
        </div>
      )}

      {/* Estado de carregamento — matches */}
      {!loadingClientes && !matchesLoaded && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-700">
            Buscando correspondências para {clientes.length} cliente
            {clientes.length !== 1 ? "s" : ""}…
          </span>
        </div>
      )}

      {/* Resumo */}
      {!loadingClientes && matchesLoaded && clientesComMatches.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-800">
            <strong className="font-semibold">
              {totalMatches} oportunidade{totalMatches !== 1 ? "s" : ""}
            </strong>{" "}
            em{" "}
            <strong className="font-semibold">
              {clientesComMatches.length} cliente
              {clientesComMatches.length !== 1 ? "s" : ""}
            </strong>
          </p>
        </div>
      )}

      {/* Estado vazio */}
      {!loadingClientes && matchesLoaded && clientesComMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            Nenhuma oportunidade encontrada
          </p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Tente reduzir o filtro de correspondência ou aguarde novos imóveis
            entrarem no portfólio.
          </p>
        </div>
      )}

      {/* Cards de clientes */}
      {!loadingClientes && (
        <div className="space-y-3">
          {clientesComMatches.map((c) => {
            const matches = (matchesMap[c.id] ?? []).filter(
              (m) => m.score >= minScore
            );
            const isExpanded = expandedIds.has(c.id);
            const pref = prefMap[c.id];

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Cabeçalho do cliente */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="text-sm font-semibold text-slate-800 hover:text-[#585a4f] transition"
                      >
                        {c.nome_completo}
                      </Link>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                        <Sparkles className="w-3 h-3" />
                        {matches.length} imóvel
                        {matches.length !== 1 ? "is" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.telefone}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-[#585a4f] hover:bg-slate-50 rounded-lg border border-slate-200 transition flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    {isExpanded ? "Recolher" : "Expandir"}
                  </button>
                </div>

                {/* Imóveis expandidos */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/60">
                    {/* Preferência do cliente resumida */}
                    {pref && <PreferenciaResumo pref={pref} />}

                    {matches.map((m) => {
                      const valor =
                        m.tipo_negocio === "locacao"
                          ? m.valor_locacao
                          : m.valor_venda;
                      const outFields = pref ? getOutFields(m, pref) : [];
                      const pct = scorePercent(m.score);
                      const scoreCls =
                        pct >= 83
                          ? "text-emerald-600 bg-emerald-50"
                          : pct >= 67
                          ? "text-amber-600 bg-amber-50"
                          : "text-slate-500 bg-slate-100";

                      return (
                        <div
                          key={m.imovel_id}
                          className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100"
                        >
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                            {m.foto_capa ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.foto_capa}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Building2 className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          {/* Informações */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800 font-mono">
                                {m.codigo}
                              </span>
                              <span className="text-xs text-slate-500">
                                {TIPO_IMOVEL_LABEL[m.tipo_imovel] ??
                                  m.tipo_imovel}
                              </span>
                              <span className="text-xs text-slate-500">
                                {TIPO_NEGOCIO_LABEL[m.tipo_negocio] ??
                                  m.tipo_negocio}
                              </span>
                              <span
                                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${scoreCls}`}
                              >
                                {pct}% match
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {m.bairro}, {m.cidade}
                              {m.dormitorios
                                ? ` · ${m.dormitorios} dorm.`
                                : ""}
                              {valor ? ` · ${formatarMoeda(valor)}` : ""}
                            </p>

                            {/* Indicadores fora da preferência */}
                            {outFields.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {outFields.map((f) => (
                                  <span
                                    key={f}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs"
                                  >
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                    {f}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                            <Link
                              href={`/imoveis/${m.imovel_id}`}
                              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-[#585a4f] hover:bg-slate-50 rounded-md border border-slate-200 transition"
                            >
                              Ver
                            </Link>
                            {c.telefone && (
                              <a
                                href={whatsappLink(
                                  c.telefone,
                                  m.codigo,
                                  m.bairro
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white rounded-md transition hover:opacity-90"
                                style={{ backgroundColor: "#25D366" }}
                                title="Avisar pelo WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Avisar
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreferenciaResumo({ pref }: { pref: Preferencia }) {
  const itens: string[] = [];
  if (pref.tipo_negocio) itens.push(TIPO_NEGOCIO_LABEL[pref.tipo_negocio] ?? pref.tipo_negocio);
  if (pref.tipo_imovel) itens.push(TIPO_IMOVEL_LABEL[pref.tipo_imovel] ?? pref.tipo_imovel);
  if (pref.cidade) itens.push(pref.cidade);
  if (pref.bairro) itens.push(pref.bairro);
  if (pref.dormitorios_min) itens.push(`${pref.dormitorios_min}+ dorm.`);
  if (pref.valor_min || pref.valor_max) {
    const faixa = [
      pref.valor_min ? formatarMoeda(pref.valor_min) : null,
      pref.valor_max ? formatarMoeda(pref.valor_max) : null,
    ]
      .filter(Boolean)
      .join(" – ");
    itens.push(faixa);
  }
  if (itens.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg mb-2">
      <span className="text-xs text-slate-400 font-medium">Busca:</span>
      {itens.map((item, i) => (
        <span
          key={i}
          className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function LegendCard() {
  const [open, setOpen] = useState(false);

  const criterios = [
    {
      num: 1,
      label: "Tipo de negócio",
      desc: "Venda, Locação — ou ambos",
    },
    {
      num: 2,
      label: "Tipo de imóvel",
      desc: "Apartamento, casa, cobertura, etc.",
    },
    {
      num: 3,
      label: "Cidade",
      desc: "Cidade preferida pelo cliente",
    },
    {
      num: 4,
      label: "Bairro",
      desc: "Bairro preferido (busca por correspondência parcial)",
    },
    {
      num: 5,
      label: "Dormitórios mínimos",
      desc: "Número mínimo de quartos solicitado",
    },
    {
      num: 6,
      label: "Faixa de valor",
      desc: "Valor mínimo e/ou máximo aceito",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Legenda dos critérios de correspondência
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-3">
            O percentual de correspondência indica quantos dos 6 critérios
            abaixo foram definidos na preferência do cliente. Quanto maior,
            mais específico e qualificado é o match.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {criterios.map((c) => (
              <div
                key={c.num}
                className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg"
              >
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: "#585a4f" }}
                >
                  {c.num}
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    {c.label}
                  </p>
                  <p className="text-xs text-slate-400">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              <span className="font-medium text-orange-700">
                Fora do esperado
              </span>{" "}
              — aparece na linha do imóvel quando algum critério está fora da
              preferência definida pelo cliente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
