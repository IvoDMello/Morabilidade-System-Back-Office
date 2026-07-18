"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Stamp, Plus, Copy, Check, Download, Ban, MessageCircle, Loader2, Trash2, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface Signatario {
  id: string;
  ordem: number;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  token: string;
  status: "pendente" | "assinada";
  assinada_em?: string | null;
}

export interface Autorizacao {
  id: string;
  imovel_id: string;
  proprietario_nome: string;
  proprietario_telefone?: string | null;
  imovel_codigo?: string | null;
  imovel_endereco?: string | null;
  imovel_bairro?: string | null;
  imovel_cidade?: string | null;
  tipo_negocio: "venda" | "locacao" | "ambos";
  exclusiva: boolean;
  prazo_dias: number;
  status: "pendente" | "parcial" | "assinada" | "cancelada" | "expirada";
  token: string;
  assinada_em?: string | null;
  created_at: string;
  // Pode faltar na resposta enquanto a API antiga estiver no ar (skew de deploy).
  signatarios?: Signatario[];
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://morabilidade.com";
export const linkAssinatura = (token: string) => `${SITE_URL.replace(/\/$/, "")}/autorizacao/${token}`;

function formatDataBR(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}

// Para a assinatura, mostramos também a hora (o navegador já converte pro fuso
// local), batendo com a trilha de auditoria do PDF.
function formatDataHoraBR(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export const STATUS_STYLE: Record<Autorizacao["status"], { label: string; cls: string }> = {
  pendente: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  parcial: { label: "Parcialmente assinada", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  assinada: { label: "Assinada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  expirada: { label: "Expirada", cls: "bg-red-50 text-red-600 border-red-200" },
};

export const NEGOCIO_LABEL: Record<Autorizacao["tipo_negocio"], string> = {
  venda: "Venda", locacao: "Locação", ambos: "Venda e locação",
};

export function AutorizacaoImovel({ imovelId }: { imovelId: string }) {
  const [itens, setItens] = useState<Autorizacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Autorizacao[]>(`/autorizacoes?imovel_id=${imovelId}`);
      setItens(res.data);
    } catch {
      toast.error("Erro ao carregar autorizações.");
    } finally {
      setLoading(false);
    }
  }, [imovelId]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4">
      <NovaAutorizacao imovelId={imovelId} onCriada={carregar} />
      <Lista itens={itens} loading={loading} onAtualizar={carregar} />
    </div>
  );
}

// ── Formulário ────────────────────────────────────────────────────────────────

const inputCls = "border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]";

interface PropRow { nome: string; telefone: string }
const rowVazia = (): PropRow => ({ nome: "", telefone: "" });

function NovaAutorizacao({ imovelId, onCriada }: { imovelId: string; onCriada: () => void }) {
  const [tipo, setTipo] = useState<"venda" | "locacao" | "ambos">("venda");
  const [valor, setValor] = useState("");
  const [exclusiva, setExclusiva] = useState(true);
  const [comissao, setComissao] = useState("6");
  const [prazo, setPrazo] = useState("180");
  const [props, setProps] = useState<PropRow[]>([rowVazia()]);
  const [salvando, setSalvando] = useState(false);

  function setProp(i: number, patch: Partial<PropRow>) {
    setProps((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function gerar(e: React.FormEvent) {
    e.preventDefault();

    // Mais de um proprietário exige nome em todas as linhas (cada um recebe o
    // próprio link de assinatura).
    const preenchidos = props.filter((p) => p.nome.trim() || p.telefone.trim());
    if (preenchidos.length > 1 && props.some((p) => !p.nome.trim())) {
      toast.error("Informe o nome de todos os proprietários.");
      return;
    }

    const payload: Record<string, unknown> = {
      imovel_id: imovelId,
      tipo_negocio: tipo,
      valor_autorizado: valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null,
      exclusiva,
      comissao_venda_pct: comissao.trim() ? Number(comissao.replace(",", ".")) : null,
      prazo_dias: Number(prazo) || 180,
    };
    if (preenchidos.length > 1) {
      payload.proprietarios = preenchidos.map((p) => ({
        nome: p.nome.trim(),
        // CPF não é mais coletado aqui, cada proprietário confirma o seu na
        // hora de assinar. A API puxa o que tiver do cadastro do imóvel.
        cpf: null,
        telefone: p.telefone.trim() || null,
      }));
    } else {
      // 1 proprietário (ou nenhum): puxa do imóvel o que faltar.
      const unico = preenchidos[0] ?? props[0];
      payload.proprietario_nome = unico.nome.trim() || null;
      payload.proprietario_cpf = null;
      payload.proprietario_telefone = unico.telefone.trim() || null;
    }

    setSalvando(true);
    try {
      const res = await api.post<{ token: string }>("/autorizacoes", payload);
      try { await navigator.clipboard.writeText(linkAssinatura(res.data.token)); } catch {}
      toast.success(
        preenchidos.length > 1
          ? "Autorização gerada, envie o link de cada proprietário pela lista abaixo."
          : "Autorização gerada, link de assinatura copiado.",
      );
      setValor(""); setProps([rowVazia()]);
      onCriada();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao gerar autorização."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <Stamp className="w-4 h-4 text-[#585a4f]" />
        <h2 className="text-sm font-semibold text-slate-700">Gerar autorização de intermediação</h2>
        <span className="text-xs text-slate-400">· o proprietário assina pelo celular</span>
      </div>

      <form onSubmit={gerar} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputCls}>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
            <option value="ambos">Venda e locação</option>
          </select>
          <input type="text" placeholder="Valor autorizado (puxa do imóvel)" value={valor}
            onChange={(e) => setValor(e.target.value)} className={inputCls} />
          <input type="number" step="0.5" placeholder="Comissão venda %" value={comissao}
            onChange={(e) => setComissao(e.target.value)} className={inputCls} />
          <input type="number" placeholder="Prazo (dias)" value={prazo}
            onChange={(e) => setPrazo(e.target.value)} className={inputCls} />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={exclusiva} onChange={(e) => setExclusiva(e.target.checked)}
            className="w-4 h-4 accent-[#585a4f]" />
          <span>Com exclusividade <span className="text-xs text-slate-400">(comissão devida mesmo em venda direta do dono no prazo, art. 726 CC)</span></span>
        </label>

        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            Proprietários
            <span className="text-xs text-slate-400"> · com 1 proprietário os dados podem ficar vazios (puxa do imóvel); cada um recebe o próprio link</span>
          </p>
          {props.map((p, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input type="text" placeholder={i === 0 ? "Nome (puxa do imóvel se vazio)" : `Nome do ${i + 1}º proprietário`}
                value={p.nome} onChange={(e) => setProp(i, { nome: e.target.value })} className={inputCls} />
              <input type="text" placeholder="WhatsApp" value={p.telefone}
                onChange={(e) => setProp(i, { telefone: e.target.value })} className={inputCls} />
              {i > 0 ? (
                <button type="button" title="Remover proprietário"
                  onClick={() => setProps((prev) => prev.filter((_, j) => j !== i))}
                  className="p-2 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 transition justify-self-start">
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : <span className="hidden sm:block" />}
            </div>
          ))}
          {props.length < 6 && (
            <button type="button" onClick={() => setProps((prev) => [...prev, rowVazia()])}
              className="flex items-center gap-1.5 text-xs text-[#585a4f] hover:underline">
              <UserPlus className="w-3.5 h-3.5" /> Adicionar proprietário (casal, herdeiros…)
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={salvando}
            className="bg-[#585a4f] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5">
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Gerar e copiar link
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Lista ─────────────────────────────────────────────────────────────────────

function Lista({ itens, loading, onAtualizar }: { itens: Autorizacao[]; loading: boolean; onAtualizar: () => void }) {
  const [confirmCancelar, setConfirmCancelar] = useState<Autorizacao | null>(null);
  const [cancelando, setCancelando] = useState(false);

  async function baixarPdf(a: Autorizacao) {
    try {
      const res = await api.get(`/autorizacoes/${a.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const el = document.createElement("a");
      el.href = url; el.download = `autorizacao-${a.proprietario_nome.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(el); el.click(); el.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Erro ao baixar PDF."); }
  }

  async function cancelar() {
    if (!confirmCancelar) return;
    setCancelando(true);
    try {
      await api.post(`/autorizacoes/${confirmCancelar.id}/cancelar`);
      toast.success("Autorização cancelada.");
      setConfirmCancelar(null);
      onAtualizar();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao cancelar."));
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <Stamp className="w-4 h-4 text-[#585a4f]" />
        <h2 className="text-sm font-semibold text-slate-700">Autorizações emitidas</h2>
        <span className="text-xs text-slate-400">· {itens.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Nenhuma autorização gerada para este imóvel ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {itens.map((a) => {
            const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.pendente;
            const ativa = a.status === "pendente" || a.status === "parcial";
            const sigs = a.signatarios ?? [];
            const nomes = sigs.length > 1
              ? sigs.map((s) => s.nome).join(" · ")
              : a.proprietario_nome;
            return (
              <li key={a.id} className="py-3 space-y-2">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{nomes}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                      {a.exclusiva && <span className="text-[11px] px-2 py-0.5 rounded-full border bg-[#d8cb6a]/20 text-[#585a4f] border-[#d8cb6a]">Exclusiva</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {NEGOCIO_LABEL[a.tipo_negocio]} · emitida em {formatDataBR(a.created_at)}
                      {a.status === "assinada" && a.assinada_em && ` · assinada em ${formatDataHoraBR(a.assinada_em)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn title="Baixar PDF" onClick={() => baixarPdf(a)}>
                      <Download className="w-4 h-4" />
                    </IconBtn>
                    {ativa && (
                      <IconBtn title="Cancelar" danger onClick={() => setConfirmCancelar(a)}>
                        <Ban className="w-4 h-4" />
                      </IconBtn>
                    )}
                  </div>
                </div>

                {/* Um link de assinatura por proprietário */}
                {ativa && sigs.length > 0 && (
                  <ul className="space-y-1">
                    {sigs.map((s) => <LinhaSignatario key={s.id} s={s} />)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmCancelar}
        onOpenChange={(o) => !o && setConfirmCancelar(null)}
        title="Cancelar autorização?"
        description="Os links de assinatura deixarão de funcionar. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar autorização"
        loading={cancelando}
        onConfirm={cancelar}
      />
    </div>
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
        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
          Assinou {s.assinada_em ? `em ${formatDataHoraBR(s.assinada_em)}` : ""}
        </span>
      ) : (
        <>
          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Pendente</span>
          <IconBtn title="Copiar link" onClick={copiar}>
            {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </IconBtn>
          <IconBtn title="Enviar no WhatsApp" onClick={whatsapp}>
            <MessageCircle className="w-4 h-4" />
          </IconBtn>
        </>
      )}
    </li>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded-md text-slate-400 transition hover:bg-slate-100 ${danger ? "hover:text-red-500" : "hover:text-[#585a4f]"}`}>
      {children}
    </button>
  );
}
