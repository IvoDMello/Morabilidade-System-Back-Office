"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquare, Trash2, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Nota {
  id: string;
  conteudo: string;
  autor_nome: string;
  created_at: string;
}

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClienteNotas({ clienteId }: { clienteId: string }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function carregar() {
    try {
      const res = await api.get<Nota[]>(`/clientes/${clienteId}/notas`);
      setNotas(res.data);
    } catch {
      toast.error("Erro ao carregar notas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo) return;
    setSalvando(true);
    try {
      const res = await api.post<Nota>(`/clientes/${clienteId}/notas`, { conteudo });
      setNotas((prev) => [res.data, ...prev]);
      setTexto("");
      textareaRef.current?.focus();
    } catch {
      toast.error("Erro ao salvar nota.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeletar(notaId: string) {
    setDeletandoId(notaId);
    try {
      await api.delete(`/clientes/${clienteId}/notas/${notaId}`);
      setNotas((prev) => prev.filter((n) => n.id !== notaId));
    } catch {
      toast.error("Erro ao remover nota.");
    } finally {
      setDeletandoId(null);
    }
  }

  return (
    <div>
      {/* Formulário de nova nota */}
      <form onSubmit={handleSubmit} className="mb-5">
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(e);
            }}
            placeholder="Registre uma interação, follow-up ou observação... (Ctrl+Enter para salvar)"
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 resize-none
              focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] placeholder:text-slate-400"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={salvando || !texto.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#585a4f" }}
            >
              {salvando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {salvando ? "Salvando..." : "Adicionar nota"}
            </button>
          </div>
        </div>
      </form>

      {/* Lista de notas */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[80, 50, 100].map((w, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-1.5 rounded-full bg-slate-200 self-stretch" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <div className={`h-3 bg-slate-200 rounded`} style={{ width: `${w}%` }} />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : notas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <MessageSquare className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">Nenhuma nota registrada ainda.</p>
          <p className="text-xs text-slate-300">Use o campo acima para registrar interações com este cliente.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {notas.map((nota) => (
            <li key={nota.id} className="flex gap-3 group">
              {/* Linha vertical */}
              <div className="flex flex-col items-center pt-1.5">
                <div className="w-2 h-2 rounded-full bg-[#585a4f] flex-shrink-0" />
                <div className="w-px flex-1 bg-slate-100 mt-1" />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 pb-3">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {nota.conteudo}
                </p>
                <div className="flex items-center justify-between mt-1.5 gap-2">
                  <p className="text-xs text-slate-400">
                    {nota.autor_nome && (
                      <span className="font-medium text-slate-500">{nota.autor_nome} · </span>
                    )}
                    {formatarData(nota.created_at)}
                  </p>
                  <button
                    onClick={() => handleDeletar(nota.id)}
                    disabled={deletandoId === nota.id}
                    className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition rounded disabled:opacity-30"
                    title="Remover nota"
                  >
                    {deletandoId === nota.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
