"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Tag } from "@/types";

const CORES_PREDEFINIDAS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6B7280",
];

const inputClass =
  "px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

interface TagRow {
  tag: Tag;
  editing: boolean;
  nome: string;
  cor: string;
}

export default function TagsPage() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  // Nova tag
  const [criando, setCriando] = useState(false);
  const [novaNome, setNovaNome] = useState("");
  const [novaCor, setNovaCor] = useState(CORES_PREDEFINIDAS[0]);
  const [salvandoNova, setSalvandoNova] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const res = await api.get<Tag[]>("/tags/");
      setRows(res.data.map((t) => ({ tag: t, editing: false, nome: t.nome, cor: t.cor ?? "#6B7280" })));
    } catch {
      toast.error("Erro ao carregar tags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function iniciarEdicao(id: string) {
    setRows((prev) => prev.map((r) => r.tag.id === id ? { ...r, editing: true } : r));
  }

  function cancelarEdicao(id: string) {
    setRows((prev) =>
      prev.map((r) => r.tag.id === id ? { ...r, editing: false, nome: r.tag.nome, cor: r.tag.cor ?? "#6B7280" } : r)
    );
  }

  async function salvarEdicao(id: string) {
    const row = rows.find((r) => r.tag.id === id);
    if (!row || !row.nome.trim()) return;
    setSalvandoId(id);
    try {
      await api.put(`/tags/${id}`, { nome: row.nome.trim(), cor: row.cor });
      toast.success("Tag atualizada.");
      await carregar();
    } catch {
      toast.error("Erro ao atualizar tag.");
    } finally {
      setSalvandoId(null);
    }
  }

  async function deletarTag(id: string, nome: string) {
    if (!confirm(`Excluir a tag "${nome}"?`)) return;
    setDeletandoId(id);
    try {
      await api.delete(`/tags/${id}`);
      toast.success("Tag excluída.");
      setRows((prev) => prev.filter((r) => r.tag.id !== id));
    } catch {
      toast.error("Erro ao excluir tag.");
    } finally {
      setDeletandoId(null);
    }
  }

  async function criarTag() {
    if (!novaNome.trim()) return;
    setSalvandoNova(true);
    try {
      await api.post("/tags/", { nome: novaNome.trim(), cor: novaCor });
      toast.success("Tag criada.");
      setNovaNome("");
      setNovaCor(CORES_PREDEFINIDAS[0]);
      setCriando(false);
      await carregar();
    } catch {
      toast.error("Erro ao criar tag.");
    } finally {
      setSalvandoNova(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
          <p className="text-slate-500 text-sm">Etiquetas configuráveis para os imóveis</p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" /> Nova tag
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              Carregando tags...
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Linha de criação */}
            {criando && (
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-blue-50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="color"
                    value={novaCor}
                    onChange={(e) => setNovaCor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-200 flex-shrink-0"
                    title="Escolher cor"
                  />
                  <input
                    value={novaNome}
                    onChange={(e) => setNovaNome(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") criarTag(); if (e.key === "Escape") setCriando(false); }}
                    className={inputClass + " flex-1 min-w-0"}
                    placeholder="Nome da tag"
                    autoFocus
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {CORES_PREDEFINIDAS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNovaCor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition ${novaCor === c ? "border-slate-700 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={criarTag}
                    disabled={salvandoNova || !novaNome.trim()}
                    className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition"
                  >
                    {salvandoNova ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setCriando(false)}
                    className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {rows.length === 0 && !criando && (
              <div className="p-12 text-center text-slate-400 text-sm">
                Nenhuma tag cadastrada. Crie a primeira tag acima.
              </div>
            )}

            {rows.map(({ tag, editing, nome, cor }) => (
              <div key={tag.id} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50 transition">
                {editing ? (
                  <>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => setRows((prev) => prev.map((r) => r.tag.id === tag.id ? { ...r, cor: e.target.value } : r))}
                        className="w-8 h-8 rounded cursor-pointer border border-slate-200 flex-shrink-0"
                      />
                      <input
                        value={nome}
                        onChange={(e) => setRows((prev) => prev.map((r) => r.tag.id === tag.id ? { ...r, nome: e.target.value } : r))}
                        onKeyDown={(e) => { if (e.key === "Enter") salvarEdicao(tag.id); if (e.key === "Escape") cancelarEdicao(tag.id); }}
                        className={inputClass + " flex-1 min-w-0"}
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {CORES_PREDEFINIDAS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setRows((prev) => prev.map((r) => r.tag.id === tag.id ? { ...r, cor: c } : r))}
                          className={`w-5 h-5 rounded-full border-2 transition ${cor === c ? "border-slate-700 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => salvarEdicao(tag.id)}
                        disabled={salvandoId === tag.id}
                        className="p-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition"
                      >
                        {salvandoId === tag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => cancelarEdicao(tag.id)}
                        className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-md transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.cor ?? "#6B7280" }} />
                    <span className="text-sm font-medium text-slate-800 flex-1">{tag.nome}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tag.cor ?? "#6B7280" }}
                    >
                      {tag.nome}
                    </span>
                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => iniciarEdicao(tag.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletarTag(tag.id, tag.nome)}
                        disabled={deletandoId === tag.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
                        title="Excluir"
                      >
                        {deletandoId === tag.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
