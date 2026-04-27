"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Pencil, Trash2, ChevronLeft, ChevronRight, Users, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Cliente } from "@/types";

interface ClienteListItem {
  id: string;
  nome_completo: string;
  email?: string;
  telefone: string;
  status?: string;
  tipo_cliente?: string;
  origem_lead?: string;
  imovel_codigo?: string;
  observacoes?: string;
  created_at: string;
}

interface Filtros {
  nome: string;
  email: string;
  status: string;
}

const FILTROS_VAZIOS: Filtros = { nome: "", email: "", status: "" };

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  ativo: { label: "Ativo", class: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  em_negociacao: { label: "Em negociação", class: "bg-blue-50 text-blue-700 ring-blue-200" },
  inativo: { label: "Inativo", class: "bg-slate-100 text-slate-500 ring-slate-200" },
  concluido: { label: "Concluído", class: "bg-violet-50 text-violet-700 ring-violet-200" },
};

const TIPO_CLIENTE_LABEL: Record<string, string> = {
  comprador: "Comprador",
  locatario: "Locatário",
  proprietario: "Proprietário",
  investidor: "Investidor",
};

const selectClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] focus:border-transparent";
const inputClass = selectClass;

export default function ClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [deletando, setDeletando] = useState<{ id: string; nome: string } | null>(null);
  const [deletandoLoading, setDeletandoLoading] = useState(false);
  const [exportando, setExportando] = useState(false);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buscar = useCallback(async (pg: number, f: Filtros) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pg), page_size: String(PAGE_SIZE) };
      if (f.nome) params.nome = f.nome;
      if (f.email) params.email = f.email;
      if (f.status) params.status = f.status;

      const res = await api.get<ClienteListItem[]>("/clientes/", { params });
      setClientes(res.data);
      setTotal(Number(res.headers["x-total-count"] ?? res.data.length));
    } catch {
      toast.error("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar(page, filtros);
  }, [page, filtros, buscar]);

  function aplicarFiltros(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    buscar(1, filtros);
    setFiltrosAbertos(false);
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
    buscar(1, FILTROS_VAZIOS);
  }

  async function handleExportar() {
    setExportando(true);
    try {
      const res = await api.get("/clientes/exportar", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso.");
    } catch {
      toast.error("Erro ao exportar CSV.");
    } finally {
      setExportando(false);
    }
  }

  async function handleDeletar() {
    if (!deletando) return;
    setDeletandoLoading(true);
    try {
      await api.delete(`/clientes/${deletando.id}`);
      toast.success("Cliente excluído com sucesso.");
      setDeletando(null);
      buscar(page, filtros);
    } catch {
      toast.error("Erro ao excluir cliente.");
    } finally {
      setDeletandoLoading(false);
    }
  }

  const temFiltrosAtivos = Object.values(filtros).some(Boolean);
  const filtrosAtivosCount = Object.values(filtros).filter(Boolean).length;

  function formatarData(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm">
            {loading ? "Carregando..." : `${total} cliente${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              filtrosAbertos || temFiltrosAtivos
                ? "border-[#585a4f]/40 text-[#585a4f] bg-[#585a4f]/5"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <Search className="w-4 h-4" />
            Filtros
            {temFiltrosAtivos && (
              <span
                className="ml-0.5 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center text-white px-1"
                style={{ backgroundColor: "#585a4f" }}
              >
                {filtrosAtivosCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExportar}
            disabled={exportando || total === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border bg-white border-slate-200 text-slate-600 hover:border-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Baixa todos os clientes em CSV"
          >
            <Download className="w-4 h-4" />
            {exportando ? "Exportando..." : "Exportar CSV"}
          </button>
          <Link
            href="/clientes/importar"
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border bg-white border-slate-200 text-slate-600 hover:border-slate-300 transition"
            title="Importa clientes de um arquivo CSV"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </Link>
          <Link
            href="/clientes/novo"
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90"
            style={{ backgroundColor: "#585a4f" }}
          >
            + Novo cliente
          </Link>
        </div>
      </div>

      {filtrosAbertos && (
        <form onSubmit={aplicarFiltros} className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
              <input
                value={filtros.nome}
                onChange={(e) => setFiltros((f) => ({ ...f, nome: e.target.value }))}
                className={inputClass}
                placeholder="Buscar por nome"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">E-mail</label>
              <input
                value={filtros.email}
                onChange={(e) => setFiltros((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
                placeholder="Buscar por e-mail"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="em_negociacao">Em negociação</option>
                <option value="inativo">Inativo</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            {temFiltrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f" }}
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-[#585a4f] rounded-full animate-spin" />
              Carregando clientes...
            </div>
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">
              {temFiltrosAtivos ? "Nenhum cliente encontrado com os filtros aplicados." : "Nenhum cliente cadastrado ainda."}
            </p>
            {!temFiltrosAtivos && (
              <Link
                href="/clientes/novo"
                className="inline-block mt-3 text-sm font-medium hover:underline"
                style={{ color: "#585a4f" }}
              >
                Cadastrar primeiro cliente →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="hidden lg:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Observação</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cadastro</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clientes.map((c) => {
                  const disp = c.status ? STATUS_LABEL[c.status] : null;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{c.nome_completo}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{c.email || c.telefone}</p>
                        {c.email && <p className="sm:hidden text-xs text-slate-400">{c.telefone}</p>}
                      </td>

                      <td className="hidden md:table-cell px-4 py-3">
                        <span className="text-slate-600">
                          {c.tipo_cliente ? TIPO_CLIENTE_LABEL[c.tipo_cliente] ?? c.tipo_cliente : "—"}
                        </span>
                        {c.tipo_cliente === "proprietario" && (
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">
                            {c.imovel_codigo || "sem imóvel"}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {disp ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${disp.class}`}>
                            {disp.label}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="hidden lg:table-cell px-4 py-3 max-w-xs">
                        {c.observacoes ? (
                          <p
                            className="text-xs text-slate-500 truncate"
                            title={c.observacoes}
                          >
                            {c.observacoes}
                          </p>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      <td className="hidden sm:table-cell px-4 py-3 text-slate-500 text-xs">{formatarData(c.created_at)}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/clientes/${c.id}`)}
                            className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletando({ id: c.id, nome: c.nome_completo })}
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className="w-7 h-7 text-xs rounded-md transition font-medium text-slate-600 hover:bg-slate-200"
                    style={pg === page ? { backgroundColor: "#585a4f", color: "#fff" } : undefined}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deletando}
        onOpenChange={(open) => { if (!open) setDeletando(null); }}
        title="Excluir cliente"
        description={`Tem certeza que deseja excluir "${deletando?.nome ?? ""}"? Esta ação não pode ser desfeita.`}
        loading={deletandoLoading}
        onConfirm={handleDeletar}
      />
    </div>
  );
}
