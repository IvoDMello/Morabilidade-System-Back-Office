"use client";

// Listagem geral de fichas de visita (todos os imóveis) — sub-aba da página
// /autorizacoes. Duas visões: a lista de fichas e o agregado de visitas por
// imóvel. A geração de novas fichas continua na aba do imóvel.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, Download, Copy, Check, MessageCircle, Building2,
  ChevronLeft, ChevronRight, List, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { linkAssinatura, STATUS_STYLE } from "@/components/fichas/fichas-imovel";

const PAGE_SIZE = 50;

interface FichaGeral {
  id: string;
  imovel_id: string;
  visitante_nome: string;
  visitante_telefone?: string | null;
  imovel_codigo?: string | null;
  imovel_endereco?: string | null;
  imovel_bairro?: string | null;
  imovel_cidade?: string | null;
  status: "pendente" | "assinada" | "cancelada" | "expirada";
  token: string;
  assinada_em?: string | null;
  created_at: string;
}

interface ResumoImovel {
  imovel_id: string;
  imovel_codigo?: string | null;
  imovel_endereco?: string | null;
  imovel_bairro?: string | null;
  imovel_cidade?: string | null;
  total: number;
  assinadas: number;
  pendentes: number;
  ultima_em?: string | null;
}

const FILTROS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "pendente", label: "Aguardando" },
  { key: "assinada", label: "Assinadas" },
  { key: "expirada", label: "Expiradas" },
  { key: "cancelada", label: "Canceladas" },
];

function formatDataBR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export function FichasGerais() {
  const [visao, setVisao] = useState<"lista" | "imovel">("lista");
  const [filtro, setFiltro] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  const periodo = useMemo(() => {
    const params = new URLSearchParams();
    if (de) params.set("de", de);
    if (ate) params.set("ate", ate);
    return params;
  }, [de, ate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Visão: lista × por imóvel */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <BotaoVisao ativo={visao === "lista"} onClick={() => setVisao("lista")}>
            <List className="w-3.5 h-3.5" /> Lista
          </BotaoVisao>
          <BotaoVisao ativo={visao === "imovel"} onClick={() => setVisao("imovel")}>
            <BarChart3 className="w-3.5 h-3.5" /> Por imóvel
          </BotaoVisao>
        </div>

        {visao === "lista" && FILTROS.map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filtro === f.key
                ? "bg-[#585a4f] text-white border-[#585a4f]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#585a4f]"
            }`}>
            {f.label}
          </button>
        ))}

        {/* Período (emissão) */}
        <div className="flex items-center gap-1.5 ml-auto">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:border-[#585a4f]" />
          <span className="text-xs text-slate-400">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:border-[#585a4f]" />
        </div>
      </div>

      <input
        type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
        placeholder="Filtrar por imóvel (código, endereço, bairro) ou visitante…"
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
      />

      {visao === "lista"
        ? <ListaGeral filtro={filtro} periodo={periodo} busca={busca} />
        : <PorImovel periodo={periodo} busca={busca} />}
    </div>
  );
}

function BotaoVisao({
  ativo, onClick, children,
}: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-3 py-1.5 flex items-center gap-1.5 transition ${
        ativo ? "bg-[#585a4f] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
      }`}>
      {children}
    </button>
  );
}

// ── Visão: lista de fichas ────────────────────────────────────────────────────

function ListaGeral({
  filtro, periodo, busca,
}: { filtro: string; periodo: URLSearchParams; busca: string }) {
  const [itens, setItens] = useState<FichaGeral[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(periodo);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      if (filtro) params.set("status", filtro);
      const res = await api.get<FichaGeral[]>(`/fichas-visita?${params}`);
      setItens(res.data);
    } catch {
      toast.error("Erro ao carregar fichas de visita.");
    } finally {
      setLoading(false);
    }
  }, [filtro, periodo, page]);

  useEffect(() => { setPage(1); }, [filtro, periodo]);
  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((f) =>
      [f.imovel_codigo, f.imovel_endereco, f.imovel_bairro, f.imovel_cidade, f.visitante_nome]
        .some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [itens, busca]);

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : visiveis.length === 0 ? (
          <p className="p-8 text-sm text-slate-400 italic text-center">
            Nenhuma ficha {busca ? "encontrada com este filtro" : filtro ? "com este status" : "emitida ainda"}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visiveis.map((f) => <LinhaFicha key={f.id} f={f} />)}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}
          className="p-1.5 rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-500">Página {page}</span>
        <button disabled={itens.length < PAGE_SIZE || loading} onClick={() => setPage((p) => p + 1)}
          className="p-1.5 rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

function LinhaFicha({ f }: { f: FichaGeral }) {
  const [copiado, setCopiado] = useState(false);
  const st = STATUS_STYLE[f.status] ?? STATUS_STYLE.pendente;
  const ativa = f.status === "pendente";
  const local = [f.imovel_bairro, f.imovel_cidade].filter(Boolean).join(" · ");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkAssinatura(f.token));
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
      toast.success("Link copiado.");
    } catch { toast.error("Não foi possível copiar."); }
  }

  function whatsapp() {
    const msg = `Olá, ${f.visitante_nome}! Segue a ficha de visita da Morabilidade para você assinar: ${linkAssinatura(f.token)}`;
    let digits = (f.visitante_telefone ?? "").replace(/\D/g, "");
    if (digits && digits.length <= 11) digits = "55" + digits;
    window.open(digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function baixarPdf() {
    try {
      const res = await api.get(`/fichas-visita/${f.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const el = document.createElement("a");
      el.href = url;
      el.download = `ficha-visita-${f.visitante_nome.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(el); el.click(); el.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Erro ao baixar PDF."); }
  }

  return (
    <li className="p-4 flex items-start gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{f.visitante_nome}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
        </div>
        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <Link href={`/imoveis/${f.imovel_id}`}
            className="hover:text-[#585a4f] hover:underline flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {f.imovel_codigo ? `${f.imovel_codigo} — ` : ""}{f.imovel_endereco ?? "Imóvel"}
          </Link>
          {local && <span>· {local}</span>}
          <span>· emitida em {formatDataBR(f.created_at)}</span>
          {f.status === "assinada" && f.assinada_em && <span>· assinada em {formatDataBR(f.assinada_em)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {ativa && (
          <>
            <button type="button" title="Copiar link" onClick={copiar}
              className="p-1.5 rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#585a4f]">
              {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <button type="button" title="Enviar no WhatsApp" onClick={whatsapp}
              className="p-1.5 rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#585a4f]">
              <MessageCircle className="w-4 h-4" />
            </button>
          </>
        )}
        <button type="button" title="Baixar PDF" onClick={baixarPdf}
          className="p-1.5 rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#585a4f]">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

// ── Visão: visitas agregadas por imóvel ──────────────────────────────────────

function PorImovel({ periodo, busca }: { periodo: URLSearchParams; busca: string }) {
  const [itens, setItens] = useState<ResumoImovel[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = periodo.toString();
      const res = await api.get<ResumoImovel[]>(`/fichas-visita/resumo/por-imovel${qs ? `?${qs}` : ""}`);
      setItens(res.data);
    } catch {
      toast.error("Erro ao carregar o resumo de visitas.");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((r) =>
      [r.imovel_codigo, r.imovel_endereco, r.imovel_bairro, r.imovel_cidade]
        .some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [itens, busca]);

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : visiveis.length === 0 ? (
        <p className="p-8 text-sm text-slate-400 italic text-center">
          Nenhuma visita {busca ? "encontrada com este filtro" : "no período"}.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visiveis.map((r) => {
            const local = [r.imovel_bairro, r.imovel_cidade].filter(Boolean).join(" · ");
            return (
              <li key={r.imovel_id} className="p-4 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Link href={`/imoveis/${r.imovel_id}`}
                    className="text-sm font-medium text-slate-800 hover:text-[#585a4f] hover:underline flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {r.imovel_codigo ? `${r.imovel_codigo} — ` : ""}{r.imovel_endereco ?? "Imóvel"}
                  </Link>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {local && `${local} · `}última visita em {formatDataBR(r.ultima_em)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] px-2 py-0.5 rounded-full border bg-[#585a4f] text-white border-[#585a4f]">
                    {r.total} visita{r.total !== 1 ? "s" : ""}
                  </span>
                  {r.assinadas > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                      {r.assinadas} assinada{r.assinadas !== 1 ? "s" : ""}
                    </span>
                  )}
                  {r.pendentes > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                      {r.pendentes} aguardando
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
