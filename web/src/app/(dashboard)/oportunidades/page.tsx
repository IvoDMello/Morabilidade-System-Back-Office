"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Building2,
  Check,
  X,
  Loader2,
  Filter,
  Users,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatarMoeda } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

const SCORE_MAX = 7;

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

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  em_negociacao: { label: "Em negociação", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200" },
  inativo: { label: "Inativo", cls: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
  concluido: { label: "Concluído", cls: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
};

interface ClienteItem {
  id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
  status?: string;
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
  vagas_garagem?: number;
  foto_capa?: string;
  score: number;
}

interface Preferencia {
  tipo_negocio?: string | null;
  tipo_imovel?: string | null;
  cidade?: string | null;
  bairros?: string[];
  valor_min?: number | null;
  valor_max?: number | null;
  dormitorios_min?: number | null;
  vagas_garagem_min?: number | null;
  observacoes?: string | null;
}

async function fetchAllClientes(): Promise<ClienteItem[]> {
  const PAGE_SIZE = 50;
  const todos: ClienteItem[] = [];
  let page = 1;
  while (true) {
    const r = await api.get<ClienteItem[]>("/clientes/", {
      params: { page: String(page), page_size: String(PAGE_SIZE) },
    });
    const batch = r.data;
    todos.push(...batch);
    const total = Number(r.headers["x-total-count"] ?? batch.length);
    if (todos.length >= total || batch.length < PAGE_SIZE) break;
    page++;
  }
  return todos;
}

interface CriterioStatus {
  key: string;
  label: string;
  detail: string;
  status: "ok" | "fail" | "na";
}

function formatMoedaCurta(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `R$ ${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
}

function getCriteriaStatus(m: Match, p: Preferencia): CriterioStatus[] {
  const criteria: CriterioStatus[] = [];

  // 1. Tipo de negócio ("ambos" não conta como critério definido)
  const prefNeg = p.tipo_negocio && p.tipo_negocio !== "ambos" ? p.tipo_negocio : null;
  if (!prefNeg) {
    criteria.push({ key: "negocio", label: "Negócio", detail: "—", status: "na" });
  } else {
    const ok = m.tipo_negocio === prefNeg || m.tipo_negocio === "ambos";
    criteria.push({ key: "negocio", label: "Negócio", detail: TIPO_NEGOCIO_LABEL[prefNeg] ?? prefNeg, status: ok ? "ok" : "fail" });
  }

  // 2. Tipo de imóvel
  if (!p.tipo_imovel) {
    criteria.push({ key: "tipo", label: "Tipo", detail: "—", status: "na" });
  } else {
    criteria.push({ key: "tipo", label: "Tipo", detail: TIPO_IMOVEL_LABEL[p.tipo_imovel] ?? p.tipo_imovel, status: m.tipo_imovel === p.tipo_imovel ? "ok" : "fail" });
  }

  // 3. Cidade
  const cidadePref = p.cidade?.trim() ?? "";
  if (!cidadePref) {
    criteria.push({ key: "cidade", label: "Cidade", detail: "—", status: "na" });
  } else {
    const ok = (m.cidade ?? "").toLowerCase().includes(cidadePref.toLowerCase());
    criteria.push({ key: "cidade", label: "Cidade", detail: cidadePref, status: ok ? "ok" : "fail" });
  }

  // 4. Bairros
  const bairrosList = (p.bairros || []).filter((b) => b.trim());
  if (!bairrosList.length) {
    criteria.push({ key: "bairro", label: "Bairro", detail: "—", status: "na" });
  } else {
    const ok = bairrosList.some((b) => (m.bairro ?? "").toLowerCase().includes(b.toLowerCase()));
    criteria.push({ key: "bairro", label: "Bairro", detail: bairrosList.join(", "), status: ok ? "ok" : "fail" });
  }

  // 5. Dormitórios (0 = sem requisito)
  const dormPref = p.dormitorios_min && p.dormitorios_min > 0 ? p.dormitorios_min : null;
  if (!dormPref) {
    criteria.push({ key: "dorm", label: "Dorm.", detail: "—", status: "na" });
  } else {
    criteria.push({ key: "dorm", label: "Dorm.", detail: `≥ ${dormPref}`, status: (m.dormitorios ?? 0) >= dormPref ? "ok" : "fail" });
  }

  // 6. Vagas de garagem
  const vagasPref = p.vagas_garagem_min && p.vagas_garagem_min > 0 ? p.vagas_garagem_min : null;
  if (!vagasPref) {
    criteria.push({ key: "vagas", label: "Vagas", detail: "—", status: "na" });
  } else {
    criteria.push({ key: "vagas", label: "Vagas", detail: `≥ ${vagasPref}`, status: (m.vagas_garagem ?? 0) >= vagasPref ? "ok" : "fail" });
  }

  // 7. Faixa de valor
  const hasValor = p.valor_min != null || p.valor_max != null;
  if (!hasValor) {
    criteria.push({ key: "valor", label: "Valor", detail: "—", status: "na" });
  } else {
    const isLocacaoMatch = m.tipo_negocio === "locacao" || (m.tipo_negocio === "ambos" && p.tipo_negocio === "locacao");
    const valor = isLocacaoMatch ? m.valor_locacao : m.valor_venda;
    let ok = valor != null;
    if (ok && valor != null) {
      if (p.valor_min != null && valor < p.valor_min) ok = false;
      if (p.valor_max != null && valor > p.valor_max) ok = false;
    }
    const partes: string[] = [];
    if (p.valor_min != null) partes.push(`≥ ${formatMoedaCurta(p.valor_min)}`);
    if (p.valor_max != null) partes.push(`≤ ${formatMoedaCurta(p.valor_max)}`);
    criteria.push({ key: "valor", label: "Valor", detail: partes.join("  "), status: ok ? "ok" : "fail" });
  }

  return criteria;
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
  const [loadingMatchesCount, setLoadingMatchesCount] = useState(0);
  const [totalMatchesLoading, setTotalMatchesLoading] = useState(0);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    async function load() {
      setLoadingClientes(true);
      setMatchesLoaded(false);

      let lista: ClienteItem[] = [];
      try {
        lista = await fetchAllClientes();
      } catch {
        lista = [];
      }

      // Filtra apenas clientes ativos
      const ativos = lista.filter((c) => c.status === "ativo");
      setClientes(ativos);
      setLoadingClientes(false);

      if (ativos.length === 0) {
        setMatchesLoaded(true);
        return;
      }

      setTotalMatchesLoading(ativos.length);

      const BATCH = 10;
      for (let i = 0; i < ativos.length; i += BATCH) {
        const batch = ativos.slice(i, i + BATCH);
        await Promise.all(
          batch.map((c) =>
            api
              .get<Match[]>(`/clientes/${c.id}/matches`)
              .then((mr) => {
                setMatchesMap((prev) => ({ ...prev, [c.id]: mr.data }));
              })
              .catch(() => {
                setMatchesMap((prev) => ({ ...prev, [c.id]: [] }));
              })
              .finally(() => {
                setLoadingMatchesCount((n) => n + 1);
              })
          )
        );
      }

      setMatchesLoaded(true);
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
          const r = await api.get<Preferencia>(`/clientes/${clienteId}/preferencia`);
          setPrefMap((prev) => ({ ...prev, [clienteId]: r.data }));
        } catch {
          setPrefMap((prev) => ({ ...prev, [clienteId]: null }));
        }
      }
    },
    [prefMap]
  );

  // Clientes com pelo menos 1 match acima do threshold
  const clientesComMatches = clientes.filter((c) => {
    const matches = matchesMap[c.id];
    if (!Array.isArray(matches) || matches.length === 0) return false;
    if (minScore === 0) return true;
    return matches.some((m) => m.score >= minScore);
  });

  const totalMatches = clientesComMatches.reduce(
    (acc, c) =>
      acc +
      (matchesMap[c.id] ?? []).filter((m) =>
        minScore === 0 ? true : m.score >= minScore
      ).length,
    0
  );

  const matchesLoadPercent =
    totalMatchesLoading > 0
      ? Math.round((loadingMatchesCount / totalMatchesLoading) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Oportunidades</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Clientes ativos com imóveis do portfólio que combinam com sua busca
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

      {/* Carregando clientes */}
      {loadingClientes && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-400">Carregando clientes…</span>
        </div>
      )}

      {/* Carregando matches — barra de progresso */}
      {!loadingClientes && !matchesLoaded && clientes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700">
                Buscando correspondências… {loadingMatchesCount}/{totalMatchesLoading} clientes
              </span>
            </div>
            <span className="text-xs text-amber-600 font-medium">{matchesLoadPercent}%</span>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${matchesLoadPercent}%`, backgroundColor: "#d8cb6a" }}
            />
          </div>
        </div>
      )}

      {/* Sem clientes ativos */}
      {!loadingClientes && clientes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhum cliente ativo encontrado</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Nenhum cliente com status <strong>Ativo</strong> foi encontrado.
            Verifique o status dos clientes na aba Clientes.
          </p>
          <Link
            href="/clientes"
            className="mt-4 px-4 py-2 text-xs font-medium text-white rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: "#585a4f" }}
          >
            Ir para Clientes
          </Link>
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
              {clientesComMatches.length} cliente{clientesComMatches.length !== 1 ? "s" : ""}
            </strong>
          </p>
        </div>
      )}

      {/* Vazio após carregar — com diagnóstico */}
      {!loadingClientes && matchesLoaded && clientes.length > 0 && clientesComMatches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma oportunidade no filtro atual</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} ativo
            {clientes.length !== 1 ? "s" : ""} encontrado
            {clientes.length !== 1 ? "s" : ""}, mas nenhum tem correspondências
            com o filtro selecionado.
          </p>
          {minScore > 0 && (
            <button
              onClick={() => setMinScore(0)}
              className="mt-4 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              Ver todos (sem filtro de correspondência)
            </button>
          )}
        </div>
      )}

      {/* Cards de clientes */}
      {!loadingClientes && clientesComMatches.length > 0 && (
        <div className="space-y-3">
          {clientesComMatches.map((c) => {
            const allMatches = matchesMap[c.id] ?? [];
            const matches = minScore === 0
              ? allMatches
              : allMatches.filter((m) => m.score >= minScore);
            const isExpanded = expandedIds.has(c.id);
            const pref = prefMap[c.id];
            const status = STATUS_LABEL[c.status ?? ""] ?? null;

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
                      {status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                          {status.label}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                        <Sparkles className="w-3 h-3" />
                        {matches.length} imóvel{matches.length !== 1 ? "is" : ""}
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
                    {pref === undefined ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                        <span className="text-xs text-slate-400">Carregando preferências…</span>
                      </div>
                    ) : pref ? (
                      <PreferenciaResumo pref={pref} />
                    ) : null}

                    {matches.map((m) => {
                      const valor =
                        m.tipo_negocio === "locacao" ? m.valor_locacao : m.valor_venda;
                      const criteria = pref != null ? getCriteriaStatus(m, pref) : null;
                      const pct = scorePercent(m.score);
                      const scoreCls =
                        pct >= 83
                          ? "text-emerald-700 bg-emerald-50"
                          : pct >= 67
                          ? "text-amber-700 bg-amber-50"
                          : "text-slate-600 bg-slate-100";

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
                                {TIPO_IMOVEL_LABEL[m.tipo_imovel] ?? m.tipo_imovel}
                              </span>
                              <span className="text-xs text-slate-500">
                                {TIPO_NEGOCIO_LABEL[m.tipo_negocio] ?? m.tipo_negocio}
                              </span>
                              <span
                                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${scoreCls}`}
                              >
                                {pct}% match
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {m.bairro}, {m.cidade}
                              {m.dormitorios ? ` · ${m.dormitorios} dorm.` : ""}
                              {valor ? ` · ${formatarMoeda(valor)}` : ""}
                            </p>

                            {criteria && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {criteria.map((crit) => (
                                  <span
                                    key={crit.key}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs ${
                                      crit.status === "ok"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : crit.status === "fail"
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-slate-50 text-slate-400 border-slate-200"
                                    }`}
                                  >
                                    {crit.status === "ok" && <Check className="w-3 h-3 flex-shrink-0" />}
                                    {crit.status === "fail" && <X className="w-3 h-3 flex-shrink-0" />}
                                    <span className={crit.status === "na" ? "text-slate-400" : "font-medium"}>
                                      {crit.label}
                                    </span>
                                    <span className={
                                      crit.status === "ok" ? "text-emerald-600" :
                                      crit.status === "fail" ? "text-red-600" :
                                      "text-slate-300"
                                    }>
                                      {crit.detail}
                                    </span>
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
                                href={whatsappLink(c.telefone, m)}
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
  if (pref.bairros?.length) itens.push(pref.bairros.join(", "));
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
    { num: 1, label: "Tipo de negócio", desc: "Venda ou Locação (\"Ambos\" não conta)" },
    { num: 2, label: "Tipo de imóvel", desc: "Apartamento, casa, cobertura, etc." },
    { num: 3, label: "Cidade", desc: "Cidade preferida pelo cliente" },
    { num: 4, label: "Bairro", desc: "Bairro preferido (correspondência parcial)" },
    { num: 5, label: "Dormitórios mínimos", desc: "Número mínimo de quartos solicitado" },
    { num: 6, label: "Faixa de valor", desc: "Valor mínimo e/ou máximo aceito" },
  ];

  const cores = [
    {
      icon: <Check className="w-3 h-3 text-emerald-600" />,
      cls: "bg-emerald-50 border-emerald-200",
      title: "Critério atendido",
      desc: "O campo foi definido na preferência e o imóvel está dentro do esperado. Conta para o % de match.",
    },
    {
      icon: <X className="w-3 h-3 text-red-600" />,
      cls: "bg-red-50 border-red-200",
      title: "Critério fora da busca",
      desc: "O campo foi definido, mas o imóvel não atende. Isso pode indicar que o match foi gerado via outro critério.",
    },
    {
      icon: <span className="text-xs text-slate-400 font-medium leading-none">—</span>,
      cls: "bg-slate-50 border-slate-200",
      title: "Não informado",
      desc: "O campo não foi preenchido na preferência. Qualquer valor do imóvel é aceito e não conta para o %.",
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
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Cores */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Indicadores por critério
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {cores.map((c) => (
                <div key={c.title} className={`flex items-start gap-2 flex-1 p-2.5 rounded-lg border ${c.cls}`}>
                  <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center mt-0.5">
                    {c.icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{c.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Critérios */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Os 6 critérios (quanto mais definidos, maior o % de match)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {criterios.map((c) => (
                <div key={c.num} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: "#585a4f" }}
                  >
                    {c.num}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-700">{c.label}</p>
                    <p className="text-xs text-slate-400">{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
