"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Plus, MessageSquare, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

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
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function diasDesde(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function AcompanhamentoImovel({ imovelId, createdAt, relatorio30diasEnviadoEm }: Props) {
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));

  const [percepcoes, setPercepcoes] = useState<Percepcao[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-4">
      {/* Status do relatório 30 dias */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 flex items-start gap-3 text-sm">
        <MailCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-slate-700">
          {relatorio30diasEnviadoEm ? (
            <>
              <strong>Relatório de 30 dias enviado</strong> em{" "}
              {formatDataBR(relatorio30diasEnviadoEm)}.
            </>
          ) : diasAnunciado >= 30 ? (
            <>
              <strong>Relatório de 30 dias pendente</strong> — será disparado
              automaticamente na próxima execução do job.
            </>
          ) : (
            <>
              Relatório automático será enviado em{" "}
              <strong>{dias30Restantes} dia{dias30Restantes === 1 ? "" : "s"}</strong>{" "}
              (30 dias após o cadastro).
            </>
          )}
        </div>
      </div>

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

  async function deletar(id: string) {
    if (!confirm("Excluir esta anotação?")) return;
    try {
      await api.delete(`/imoveis/${imovelId}/percepcoes/${id}`);
      toast.success("Anotação excluída.");
      onAtualizar();
    } catch {
      toast.error("Erro ao excluir.");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-[#585a4f]" />
        <h2 className="text-sm font-semibold text-slate-700">Percepção do cliente</h2>
        <span className="text-xs text-slate-400">
          · histórico interno — alimenta o relatório de 30 dias
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
                onClick={() => deletar(p.id)}
                className="text-slate-300 hover:text-red-500 p-1"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
