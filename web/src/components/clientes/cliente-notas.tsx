"use client";

import { useEffect, useState, useRef } from "react";
import {
  MessageSquare, Trash2, Send, Loader2, Phone, MessageCircle, Mail,
  Home, Users, StickyNote, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type TipoContato = "nota" | "ligacao" | "whatsapp" | "email" | "visita" | "presencial";

interface Nota {
  id: string;
  conteudo: string;
  tipo_contato?: TipoContato;
  autor_nome: string;
  created_at: string;
}

const TIPOS: Record<TipoContato, { label: string; icon: LucideIcon; cor: string }> = {
  nota: { label: "Nota", icon: StickyNote, cor: "#585a4f" },
  ligacao: { label: "Ligação", icon: Phone, cor: "#2563eb" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, cor: "#16a34a" },
  email: { label: "E-mail", icon: Mail, cor: "#d97706" },
  visita: { label: "Visita", icon: Home, cor: "#9333ea" },
  presencial: { label: "Presencial", icon: Users, cor: "#0d9488" },
};

const ORDEM_TIPOS = Object.keys(TIPOS) as TipoContato[];

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
  const [tipo, setTipo] = useState<TipoContato>("nota");
  const [filtro, setFiltro] = useState<TipoContato | "">("");
  const [salvando, setSalvando] = useState(false);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function carregar() {
    try {
      const res = await api.get<Nota[]>(`/clientes/${clienteId}/notas`);
      setNotas(res.data);
    } catch {
      toast.error("Erro ao carregar o histórico de contato.");
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
      const res = await api.post<Nota>(`/clientes/${clienteId}/notas`, {
        conteudo,
        tipo_contato: tipo,
      });
      setNotas((prev) => [res.data, ...prev]);
      setTexto("");
      textareaRef.current?.focus();
    } catch {
      toast.error("Erro ao salvar o registro.");
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
      toast.error("Erro ao remover o registro.");
    } finally {
      setDeletandoId(null);
    }
  }

  const visiveis = filtro ? notas.filter((n) => (n.tipo_contato ?? "nota") === filtro) : notas;

  return (
    <div>
      {/* Formulário de novo registro */}
      <form onSubmit={handleSubmit} className="mb-5">
        <div className="flex flex-col gap-2">
          {/* Canal do contato, fita rolável no mobile, wrap no desktop */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ORDEM_TIPOS.map((t) => {
              const cfg = TIPOS[t];
              const Icone = cfg.icon;
              const ativo = tipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs rounded-full border transition ${
                    ativo
                      ? "text-white border-transparent"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                  style={ativo ? { backgroundColor: cfg.cor } : undefined}
                >
                  <Icone className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(e);
            }}
            placeholder="Registre uma interação, follow-up ou observação..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 resize-none
              focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <p className="hidden sm:block text-[11px] text-slate-300 mr-auto">Ctrl+Enter para salvar</p>
            <button
              type="submit"
              disabled={salvando || !texto.trim()}
              className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 text-sm font-medium text-white rounded-lg transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#585a4f" }}
            >
              {salvando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {salvando ? "Salvando..." : "Registrar contato"}
            </button>
          </div>
        </div>
      </form>

      {/* Filtro por canal */}
      {notas.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs text-slate-400 mr-1 flex-shrink-0">Mostrar:</span>
          <button
            type="button"
            onClick={() => setFiltro("")}
            className={`flex-shrink-0 whitespace-nowrap px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs rounded-full border transition ${
              filtro === ""
                ? "bg-slate-700 text-white border-transparent"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            Todos ({notas.length})
          </button>
          {ORDEM_TIPOS.map((t) => {
            const qtd = notas.filter((n) => (n.tipo_contato ?? "nota") === t).length;
            if (qtd === 0) return null;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFiltro(filtro === t ? "" : t)}
                className={`flex-shrink-0 whitespace-nowrap px-2.5 py-1 sm:px-2 sm:py-0.5 text-xs rounded-full border transition ${
                  filtro === t
                    ? "text-white border-transparent"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
                style={filtro === t ? { backgroundColor: TIPOS[t].cor } : undefined}
              >
                {TIPOS[t].label} ({qtd})
              </button>
            );
          })}
        </div>
      )}

      {/* Linha do tempo */}
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
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <MessageSquare className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400">
            {notas.length === 0 ? "Nenhum contato registrado ainda." : "Nenhum registro neste canal."}
          </p>
          {notas.length === 0 && (
            <p className="text-xs text-slate-300">Use o campo acima para registrar interações com este cliente.</p>
          )}
        </div>
      ) : (
        <ol className="space-y-3">
          {visiveis.map((nota) => {
            const cfg = TIPOS[nota.tipo_contato ?? "nota"] ?? TIPOS.nota;
            const Icone = cfg.icon;
            return (
              <li key={nota.id} className="flex gap-3 group">
                {/* Ícone do canal + linha vertical */}
                <div className="flex flex-col items-center pt-0.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cfg.cor}18` }}
                    title={cfg.label}
                  >
                    <Icone className="w-3 h-3" style={{ color: cfg.cor }} />
                  </div>
                  <div className="w-px flex-1 bg-slate-100 mt-1" />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {nota.conteudo}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <p className="text-xs text-slate-400">
                      <span className="font-medium" style={{ color: cfg.cor }}>{cfg.label}</span>
                      {" · "}
                      {nota.autor_nome && (
                        <span className="font-medium text-slate-500">{nota.autor_nome} · </span>
                      )}
                      {formatarData(nota.created_at)}
                    </p>
                    <button
                      onClick={() => handleDeletar(nota.id)}
                      disabled={deletandoId === nota.id}
                      className="p-2 sm:p-1 text-slate-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition rounded disabled:opacity-30"
                      title="Remover registro"
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
            );
          })}
        </ol>
      )}
    </div>
  );
}
