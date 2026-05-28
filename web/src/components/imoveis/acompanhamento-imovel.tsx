"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Trash2, Plus, Eye, MessageSquare, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface Visita {
  id: string;
  visitante_nome: string;
  visitante_telefone?: string | null;
  data_visita: string; // YYYY-MM-DD
  comentario?: string | null;
  created_at: string;
}

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

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [percepcoes, setPercepcoes] = useState<Percepcao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, pRes] = await Promise.all([
        api.get<Visita[]>(`/imoveis/${imovelId}/visitas`),
        isAdmin
          ? api.get<Percepcao[]>(`/imoveis/${imovelId}/percepcoes`)
          : Promise.resolve({ data: [] as Percepcao[] }),
      ]);
      setVisitas(vRes.data);
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

      {/* Visitas */}
      <SecaoVisitas
        imovelId={imovelId}
        visitas={visitas}
        loading={loading}
        isAdmin={isAdmin}
        onAtualizar={carregar}
      />

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

// ── Visitas ──────────────────────────────────────────────────────────────────

function SecaoVisitas({
  imovelId, visitas, loading, isAdmin, onAtualizar,
}: {
  imovelId: string;
  visitas: Visita[];
  loading: boolean;
  isAdmin: boolean;
  onAtualizar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataVisita, setDataVisita] = useState(() => new Date().toISOString().slice(0, 10));
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do visitante.");
      return;
    }
    setSalvando(true);
    try {
      await api.post(`/imoveis/${imovelId}/visitas`, {
        visitante_nome: nome.trim(),
        visitante_telefone: telefone.trim() || null,
        data_visita: dataVisita,
        comentario: comentario.trim() || null,
      });
      setNome("");
      setTelefone("");
      setComentario("");
      toast.success("Visita registrada.");
      onAtualizar();
    } catch {
      toast.error("Erro ao registrar visita.");
    } finally {
      setSalvando(false);
    }
  }

  async function importarCSV(file: File) {
    const fd = new FormData();
    fd.append("arquivo", file);
    try {
      const res = await api.post<Visita[]>(
        `/imoveis/${imovelId}/visitas/import-csv`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success(`${res.data.length} visita(s) importada(s).`);
      onAtualizar();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || "Erro ao importar CSV.");
    }
  }

  async function deletar(id: string) {
    if (!confirm("Excluir esta visita?")) return;
    try {
      await api.delete(`/imoveis/${imovelId}/visitas/${id}`);
      toast.success("Visita excluída.");
      onAtualizar();
    } catch {
      toast.error("Erro ao excluir.");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#585a4f]" />
          <h2 className="text-sm font-semibold text-slate-700">Visitas</h2>
          <span className="text-xs text-slate-400">· {visitas.length} registrada{visitas.length === 1 ? "" : "s"}</span>
        </div>
        <div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importarCSV(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar CSV
          </button>
        </div>
      </div>

      {/* Form rápido */}
      <form
        onSubmit={adicionar}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4"
      >
        <input
          type="text"
          placeholder="Nome do visitante"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
        />
        <input
          type="text"
          placeholder="Telefone (opcional)"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
        />
        <input
          type="date"
          value={dataVisita}
          onChange={(e) => setDataVisita(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f]"
        />
        <button
          type="submit"
          disabled={salvando}
          className="bg-[#585a4f] text-white text-sm px-4 py-2 rounded-md hover:bg-[#4a4c42] disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
        <textarea
          placeholder="Comentário do visitante (opcional)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={2}
          className="sm:col-span-2 lg:col-span-4 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#585a4f] resize-none"
        />
      </form>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : visitas.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Nenhuma visita registrada ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {visitas.map((v) => (
            <li key={v.id} className="py-3 flex items-start gap-3">
              <div className="text-xs text-slate-400 w-20 shrink-0 pt-0.5">
                {formatDataBR(v.data_visita)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{v.visitante_nome}</div>
                {v.visitante_telefone && (
                  <div className="text-xs text-slate-500">{v.visitante_telefone}</div>
                )}
                {v.comentario && (
                  <div className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{v.comentario}</div>
                )}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => deletar(v.id)}
                  className="text-slate-300 hover:text-red-500 p-1"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400 mt-3">
        CSV aceito: colunas <code>visitante_nome</code>, <code>visitante_telefone</code>,{" "}
        <code>data_visita</code>, <code>comentario</code>.
      </p>
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
