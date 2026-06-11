"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Stamp, Loader2, Download, Copy, Check, MessageCircle, Building2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  type Autorizacao, type Signatario,
  STATUS_STYLE, NEGOCIO_LABEL, linkAssinatura,
} from "@/components/fichas/autorizacao-imovel";

const PAGE_SIZE = 50;

const FILTROS: { key: string; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "pendente", label: "Aguardando" },
  { key: "parcial", label: "Parciais" },
  { key: "assinada", label: "Assinadas" },
  { key: "expirada", label: "Expiradas" },
  { key: "cancelada", label: "Canceladas" },
];

function formatDataBR(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** Fim da vigência da exclusividade: assinatura + prazo em dias. */
function vigencia(a: Autorizacao): { fim: Date; diasRestantes: number } | null {
  if (a.status !== "assinada" || !a.assinada_em) return null;
  const inicio = new Date(a.assinada_em);
  if (isNaN(inicio.getTime())) return null;
  const fim = new Date(inicio.getTime() + a.prazo_dias * 86_400_000);
  const diasRestantes = Math.ceil((fim.getTime() - Date.now()) / 86_400_000);
  return { fim, diasRestantes };
}

export default function AutorizacoesPage() {
  const [itens, setItens] = useState<Autorizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [page, setPage] = useState(1);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (filtro) params.set("status", filtro);
      const res = await api.get<Autorizacao[]>(`/autorizacoes?${params}`);
      setItens(res.data);
    } catch {
      toast.error("Erro ao carregar autorizações.");
    } finally {
      setLoading(false);
    }
  }, [filtro, page]);

  useEffect(() => { carregar(); }, [carregar]);

  const resumo = useMemo(() => {
    const vencendo = itens.filter((a) => {
      const v = vigencia(a);
      return v && v.diasRestantes > 0 && v.diasRestantes <= 15;
    }).length;
    return { vencendo };
  }, [itens]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Stamp className="w-5 h-5 text-[#585a4f]" />
        <h1 className="text-lg font-semibold text-slate-800">Autorizações de intermediação</h1>
      </div>
      <p className="text-sm text-slate-500 -mt-2">
        Contratos de exclusividade assinados pelos proprietários, de todos os imóveis.
        Para gerar uma nova autorização, abra o imóvel e use a aba &quot;Autorização&quot;.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button key={f.key} onClick={() => { setFiltro(f.key); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filtro === f.key
                ? "bg-[#585a4f] text-white border-[#585a4f]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#585a4f]"
            }`}>
            {f.label}
          </button>
        ))}
        {resumo.vencendo > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {resumo.vencendo} exclusividade{resumo.vencendo > 1 ? "s" : ""} vencendo em até 15 dias
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : itens.length === 0 ? (
          <p className="p-8 text-sm text-slate-400 italic text-center">
            Nenhuma autorização {filtro ? "com este status" : "emitida ainda"}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {itens.map((a) => <LinhaAutorizacao key={a.id} a={a} />)}
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
    </div>
  );
}

function LinhaAutorizacao({ a }: { a: Autorizacao }) {
  const st = STATUS_STYLE[a.status];
  const ativa = a.status === "pendente" || a.status === "parcial";
  const v = vigencia(a);
  const nomes = a.signatarios.length > 0 ? a.signatarios.map((s) => s.nome).join(" · ") : a.proprietario_nome;
  const local = [a.imovel_bairro, a.imovel_cidade].filter(Boolean).join(" · ");

  async function baixarPdf() {
    try {
      const res = await api.get(`/autorizacoes/${a.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const el = document.createElement("a");
      el.href = url;
      el.download = `autorizacao-${(a.imovel_codigo ?? a.id.slice(0, 8)).toLowerCase()}.pdf`;
      document.body.appendChild(el); el.click(); el.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Erro ao baixar PDF."); }
  }

  return (
    <li className="p-4 space-y-2">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/imoveis/${a.imovel_id}`}
              className="text-sm font-medium text-slate-800 hover:text-[#585a4f] hover:underline flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {a.imovel_codigo ? `${a.imovel_codigo} — ` : ""}{a.imovel_endereco ?? "Imóvel"}
            </Link>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
            {a.exclusiva && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border bg-[#d8cb6a]/20 text-[#585a4f] border-[#d8cb6a]">Exclusiva</span>
            )}
            {v && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                v.diasRestantes <= 0
                  ? "bg-red-50 text-red-600 border-red-200"
                  : v.diasRestantes <= 15
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
              }`}>
                {v.diasRestantes <= 0
                  ? `Vigência encerrada em ${formatDataBR(v.fim.toISOString())}`
                  : `Vence em ${v.diasRestantes} dia${v.diasRestantes > 1 ? "s" : ""} (${formatDataBR(v.fim.toISOString())})`}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {nomes} · {NEGOCIO_LABEL[a.tipo_negocio]} · {a.prazo_dias} dias · emitida em {formatDataBR(a.created_at)}
            {local && ` · ${local}`}
          </div>
        </div>
        <button type="button" title="Baixar PDF" onClick={baixarPdf}
          className="p-1.5 rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-[#585a4f]">
          <Download className="w-4 h-4" />
        </button>
      </div>

      {ativa && a.signatarios.length > 0 && (
        <ul className="space-y-1">
          {a.signatarios.map((s) => <LinhaSignatario key={s.id} s={s} />)}
        </ul>
      )}
    </li>
  );
}

function LinhaSignatario({ s }: { s: Signatario }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkAssinatura(s.token));
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
      toast.success("Link copiado.");
    } catch { toast.error("Não foi possível copiar."); }
  }

  function whatsapp() {
    const msg = `Olá, ${s.nome}! Segue a autorização de intermediação da Morabilidade para você assinar: ${linkAssinatura(s.token)}`;
    let digits = (s.telefone ?? "").replace(/\D/g, "");
    if (digits && digits.length <= 11) digits = "55" + digits;
    window.open(digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const assinou = s.status === "assinada";
  return (
    <li className="flex items-center gap-2 pl-3 border-l-2 border-slate-100">
      <span className="text-xs text-slate-600 flex-1 min-w-0 truncate">{s.nome}</span>
      {assinou ? (
        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Assinou</span>
      ) : (
        <>
          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Pendente</span>
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
    </li>
  );
}
