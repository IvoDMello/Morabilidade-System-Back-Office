"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Plus, MessageSquare, MailCheck, Send, Loader2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Percepcao {
  id: string;
  texto: string;
  created_at: string;
}

interface Props {
  imovelId: string;
  createdAt: string;
  relatorio30diasEnviadoEm?: string | null;
}

function formatDataBR(iso: string) {
  if (!iso) return "-";
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function diasDesde(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** Data em que o imóvel completa 30 dias (cadastro + 30 dias). */
function dataDisponivel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("pt-BR");
}

export function AcompanhamentoImovel({ imovelId, createdAt, relatorio30diasEnviadoEm }: Props) {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));

  const [percepcoes, setPercepcoes] = useState<Percepcao[]>([]);
  const [loading, setLoading] = useState(true);

  // Espelha o prop, mas atualiza na hora após um envio manual.
  const [enviadoEm, setEnviadoEm] = useState<string | null>(relatorio30diasEnviadoEm ?? null);
  useEffect(() => { setEnviadoEm(relatorio30diasEnviadoEm ?? null); }, [relatorio30diasEnviadoEm]);
  const [enviando, setEnviando] = useState(false);

  // Prévia: URL do PDF (object URL) e estado de carregamento.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);

  async function enviarRelatorio() {
    setEnviando(true);
    try {
      const res = await api.post<{ relatorio_30dias_enviado_em: string | null }>(
        `/imoveis/${imovelId}/relatorio-30dias/enviar`,
      );
      setEnviadoEm(res.data.relatorio_30dias_enviado_em ?? new Date().toISOString());
      toast.success("Relatório enviado por e-mail.");
      fecharPreview();
    } catch (err) {
      toast.error(getErrorMessage(err, "Erro ao enviar o relatório."));
    } finally {
      setEnviando(false);
    }
  }

  async function abrirPreview() {
    setGerandoPreview(true);
    try {
      const res = await api.get(`/imoveis/${imovelId}/relatorio-30dias/preview`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setPreviewUrl(url);
    } catch (err) {
      // Em respostas blob o detalhe vem como Blob; tenta extrair, senão usa fallback.
      let msg = "Erro ao gerar a prévia do relatório.";
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text());
          if (parsed?.detail) msg = String(parsed.detail);
        } catch {}
      } else {
        msg = getErrorMessage(err, msg);
      }
      toast.error(msg);
    } finally {
      setGerandoPreview(false);
    }
  }

  function fecharPreview() {
    setPreviewUrl((url) => {
      if (url) window.URL.revokeObjectURL(url);
      return null;
    });
  }

  useEffect(() => {
    return () => { if (previewUrl) window.URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const carregar = useCallback(async () => {
    if (!isAdmin) {
      setPercepcoes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pRes = await api.get<Percepcao[]>(`/imoveis/${imovelId}/percepcoes`);
      setPercepcoes(pRes.data);
    } catch {
      toast.error("Erro ao carregar acompanhamento.");
    } finally {
      setLoading(false);
    }
  }, [imovelId, isAdmin]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const diasAnunciado = diasDesde(createdAt);
  const dias30Restantes = Math.max(0, 30 - diasAnunciado);
  const disponivel = diasAnunciado >= 30;

  // Cor do card por estado: enviado = verde, disponível = âmbar, contagem = slate.
  const cor = enviadoEm
    ? "bg-emerald-50/60 border-emerald-200 text-emerald-600"
    : disponivel
      ? "bg-amber-50/60 border-amber-200 text-amber-600"
      : "bg-slate-50 border-slate-200 text-slate-500";

  return (
    <div className="space-y-4">
      {/* Status do relatório 30 dias */}
      <div className={`border rounded-lg p-3 flex items-start gap-3 text-sm ${cor}`}>
        <MailCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 text-slate-700">
          {enviadoEm ? (
            <>
              <strong>Relatório de 30 dias enviado</strong> em {formatDataBR(enviadoEm)}.
            </>
          ) : disponivel ? (
            <>
              <strong>Relatório de 30 dias disponível</strong>, será enviado
              automaticamente no próximo disparo (09:00), ou envie agora.
            </>
          ) : (
            <>
              Faltam <strong>{dias30Restantes} dia{dias30Restantes === 1 ? "" : "s"}</strong>{" "}
              para o relatório de 30 dias (disponível em {dataDisponivel(createdAt)}).
            </>
          )}
        </div>
        {isAdmin && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={abrirPreview}
              disabled={gerandoPreview || enviando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#585a4f]/40 text-[#585a4f] hover:bg-[#585a4f]/5 disabled:opacity-60"
              title="Gera o PDF e abre uma prévia, sem enviar e-mail"
            >
              {gerandoPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              Pré-visualizar
            </button>
            <button
              type="button"
              onClick={enviarRelatorio}
              disabled={enviando || gerandoPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#585a4f] text-white hover:bg-[#4a4c42] disabled:opacity-60"
              title="Gera o PDF e envia o relatório por e-mail agora"
            >
              {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {enviadoEm ? "Reenviar" : "Enviar agora"}
            </button>
          </div>
        )}
      </div>

      {/* Modal de prévia do relatório */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={fecharPreview}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Eye className="w-4 h-4 text-[#585a4f]" />
                Prévia do relatório de 30 dias
              </div>
              <button
                type="button"
                onClick={fecharPreview}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <iframe src={previewUrl} title="Prévia do relatório" className="flex-1 w-full" />

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                Esta é apenas uma prévia, nenhum e-mail foi enviado ainda.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fecharPreview}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={enviarRelatorio}
                  disabled={enviando}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-[#585a4f] text-white hover:bg-[#4a4c42] disabled:opacity-60"
                >
                  {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar por e-mail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Percepções (apenas admin) */}
      {isAdmin && (
        <SecaoPercepcoes
          imovelId={imovelId}
          percepcoes={percepcoes}
          loading={loading}
          onAtualizar={carregar}
        />
      )}
    </div>
  );
}

// ── Percepções ───────────────────────────────────────────────────────────────

function SecaoPercepcoes({
  imovelId, percepcoes, loading, onAtualizar,
}: {
  imovelId: string;
  percepcoes: Percepcao[];
  loading: boolean;
  onAtualizar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aExcluir, setAExcluir] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/imoveis/${imovelId}/percepcoes`, { texto: texto.trim() });
      setTexto("");
      toast.success("Anotação adicionada.");
      onAtualizar();
    } catch {
      toast.error("Erro ao salvar anotação.");
    } finally {
      setSalvando(false);
    }
  }

  async function deletar() {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await api.delete(`/imoveis/${imovelId}/percepcoes/${aExcluir}`);
      toast.success("Anotação excluída.");
      setAExcluir(null);
      onAtualizar();
    } catch {
      toast.error("Erro ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-[#585a4f]" />
        <h2 className="text-sm font-semibold text-slate-700">Percepção do cliente</h2>
        <span className="text-xs text-slate-400">
          · histórico interno, alimenta o relatório de 30 dias
        </span>
      </div>

      <form onSubmit={adicionar} className="mb-4">
        <textarea
          placeholder="Nova anotação (ex: visitante achou o valor alto, dois preferiram bairro vizinho…)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f] resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={salvando || !texto.trim()}
            className="bg-[#585a4f] text-white text-sm px-4 py-2 rounded-md hover:bg-[#4a4c42] disabled:opacity-60 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : percepcoes.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Nenhuma anotação ainda.</p>
      ) : (
        <ul className="space-y-3">
          {percepcoes.map((p) => (
            <li key={p.id} className="bg-slate-50 border-l-2 border-[#d8cb6a] rounded-r-md p-3 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{p.texto}</div>
                <div className="text-xs text-slate-400 mt-1">{formatDataBR(p.created_at)}</div>
              </div>
              <button
                type="button"
                onClick={() => setAExcluir(p.id)}
                className="text-slate-300 hover:text-red-500 p-1"
                title="Excluir"
                aria-label="Excluir anotação"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={aExcluir !== null}
        onOpenChange={(open) => !open && setAExcluir(null)}
        title="Excluir anotação"
        description="Esta anotação de percepção será removida permanentemente."
        loading={excluindo}
        onConfirm={deletar}
      />
    </div>
  );
}
