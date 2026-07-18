"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileSignature, Plus, Copy, Check, Download, Ban, MessageCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Ficha {
  id: string;
  visitante_nome: string;
  visitante_telefone?: string | null;
  corretor_nome?: string | null;
  status: "pendente" | "assinada" | "cancelada" | "expirada";
  token: string;
  assinada_em?: string | null;
  created_at: string;
}

interface CorretorOption {
  id: string;
  nome_completo: string;
  creci?: string | null;
  ativo?: boolean;
}

interface Props {
  imovelId: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://morabilidade.com";

export function linkAssinatura(token: string) {
  return `${SITE_URL.replace(/\/$/, "")}/ficha/${token}`;
}

function formatDataBR(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
}

export const STATUS_STYLE: Record<Ficha["status"], { label: string; cls: string }> = {
  pendente: { label: "Aguardando assinatura", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  assinada: { label: "Assinada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  expirada: { label: "Expirada", cls: "bg-red-50 text-red-600 border-red-200" },
};

export function FichasImovel({ imovelId }: Props) {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Ficha[]>(`/fichas-visita?imovel_id=${imovelId}`);
      setFichas(res.data);
    } catch {
      toast.error("Erro ao carregar fichas de visita.");
    } finally {
      setLoading(false);
    }
  }, [imovelId]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="space-y-4">
      <NovaFicha imovelId={imovelId} onCriada={carregar} />
      <ListaFichas fichas={fichas} loading={loading} onAtualizar={carregar} />
    </div>
  );
}

// ── Formulário de geração ────────────────────────────────────────────────────

function NovaFicha({ imovelId, onCriada }: { imovelId: string; onCriada: () => void }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.perfil === "admin";
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  // Só admin escolhe o corretor responsável; corretor emite em nome próprio.
  const [corretorId, setCorretorId] = useState("");
  const [corretores, setCorretores] = useState<CorretorOption[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api.get<CorretorOption[]>("/usuarios/")
      .then((res) => setCorretores(res.data.filter((u) => u.ativo !== false)))
      .catch(() => {});
  }, [isAdmin]);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { toast.error("Informe o nome do visitante."); return; }
    if (!telefone.trim()) {
      toast.error("Informe o WhatsApp do visitante, é por ele que o link é enviado e o cliente cadastrado.");
      return;
    }
    setSalvando(true);
    try {
      const res = await api.post<{ token: string }>(
        "/fichas-visita",
        {
          imovel_id: imovelId,
          visitante_nome: nome.trim(),
          visitante_cpf: cpf.trim() || null,
          visitante_telefone: telefone.trim() || null,
          visitante_email: email.trim() || null,
          corretor_id: corretorId || null,
        },
      );
      // Já copia o link pro corretor mandar.
      try { await navigator.clipboard.writeText(linkAssinatura(res.data.token)); } catch {}
      toast.success("Ficha gerada, link de assinatura copiado.");
      setNome(""); setCpf(""); setTelefone(""); setEmail("");
      onCriada();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao gerar ficha."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <FileSignature className="w-4 h-4 text-[#585a4f]" />
        <h2 className="text-sm font-semibold text-slate-700">Gerar ficha de visita</h2>
        <span className="text-xs text-slate-400">
          · o visitante assina pelo celular e, ao assinar, entra no cadastro de clientes
        </span>
      </div>

      <form onSubmit={gerar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input
          type="text" placeholder="Nome do visitante *" value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="lg:col-span-2 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
        />
        <input
          type="text" placeholder="CPF" value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
        />
        <input
          type="text" placeholder="WhatsApp *" value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
        />
        <input
          type="email" placeholder="E-mail (opcional)" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${isAdmin ? "lg:col-span-1" : "lg:col-span-3"} border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]`}
        />
        {isAdmin && (
          <select
            value={corretorId}
            onChange={(e) => setCorretorId(e.target.value)}
            title="Corretor responsável, é o nome/CRECI que sai no documento assinado"
            className="lg:col-span-2 border border-slate-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#585a4f]"
          >
            <option value="">Corretor responsável: eu ({user?.nome_completo})</option>
            {corretores.filter((c) => c.id !== user?.id).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_completo}{c.creci ? `: CRECI ${c.creci}` : ", sem CRECI"}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit" disabled={salvando}
          className="bg-[#585a4f] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Gerar e copiar link
        </button>
      </form>
    </div>
  );
}

// ── Lista ─────────────────────────────────────────────────────────────────────

function ListaFichas({
  fichas, loading, onAtualizar,
}: { fichas: Ficha[]; loading: boolean; onAtualizar: () => void }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [confirmCancelar, setConfirmCancelar] = useState<Ficha | null>(null);
  const [cancelando, setCancelando] = useState(false);

  async function copiarLink(ficha: Ficha) {
    try {
      await navigator.clipboard.writeText(linkAssinatura(ficha.token));
      setCopiado(ficha.id);
      setTimeout(() => setCopiado(null), 2000);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  function enviarWhatsApp(ficha: Ficha) {
    const link = linkAssinatura(ficha.token);
    const msg = `Olá, ${ficha.visitante_nome}!\n\nPara adiantarmos os preparativos da sua visita, estou encaminhando nossa ficha de visita.\n\nÉ necessário apenas preencher o campo do CPF. A assinatura pode ser feita diretamente na tela do celular, com o próprio dedo, podendo ser inclusive uma rubrica.\n\n${link}\n\nFico à disposição. Até breve!`;
    let digits = (ficha.visitante_telefone ?? "").replace(/\D/g, "");
    if (digits && digits.length <= 11) digits = "55" + digits;
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  async function baixarPdf(ficha: Ficha) {
    try {
      const res = await api.get(`/fichas-visita/${ficha.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ficha-visita-${ficha.visitante_nome.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao baixar PDF.");
    }
  }

  async function cancelar() {
    if (!confirmCancelar) return;
    setCancelando(true);
    try {
      await api.post(`/fichas-visita/${confirmCancelar.id}/cancelar`);
      toast.success("Ficha cancelada.");
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
        <FileSignature className="w-4 h-4 text-[#585a4f]" />
        <h2 className="text-sm font-semibold text-slate-700">Fichas emitidas</h2>
        <span className="text-xs text-slate-400">· {fichas.length}</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : fichas.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Nenhuma ficha gerada para este imóvel ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {fichas.map((f) => {
            const st = STATUS_STYLE[f.status];
            const ativa = f.status === "pendente";
            return (
              <li key={f.id} className="py-3 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800">{f.visitante_nome}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Emitida em {formatDataBR(f.created_at)}
                    {f.corretor_nome && ` · corretor: ${f.corretor_nome}`}
                    {f.status === "assinada" && f.assinada_em && ` · assinada em ${formatDataBR(f.assinada_em)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {ativa && (
                    <>
                      <IconBtn title="Copiar link" onClick={() => copiarLink(f)}>
                        {copiado === f.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </IconBtn>
                      <IconBtn title="Enviar no WhatsApp" onClick={() => enviarWhatsApp(f)}>
                        <MessageCircle className="w-4 h-4" />
                      </IconBtn>
                    </>
                  )}
                  <IconBtn title="Baixar PDF" onClick={() => baixarPdf(f)}>
                    <Download className="w-4 h-4" />
                  </IconBtn>
                  {ativa && (
                    <IconBtn title="Cancelar" danger onClick={() => setConfirmCancelar(f)}>
                      <Ban className="w-4 h-4" />
                    </IconBtn>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmCancelar}
        onOpenChange={(o) => !o && setConfirmCancelar(null)}
        title="Cancelar ficha de visita?"
        description="O link de assinatura deixará de funcionar. Esta ação não pode ser desfeita."
        confirmLabel="Cancelar ficha"
        loading={cancelando}
        onConfirm={cancelar}
      />
    </div>
  );
}

function IconBtn({
  children, title, onClick, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded-md text-slate-400 transition hover:bg-slate-100 ${danger ? "hover:text-red-500" : "hover:text-[#585a4f]"}`}
    >
      {children}
    </button>
  );
}
