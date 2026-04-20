"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatarMoeda } from "@/lib/utils";
import type { ImovelListOut } from "@/types";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Filtros {
  codigo: string;
  tipo_negocio: string;
  disponibilidade: string;
  cidade: string;
  bairro: string;
  tipo_imovel: string;
  dormitorios_min: string;
  preco_min: string;
  preco_max: string;
  condicao: string;
  mobiliado: string;
}

const FILTROS_VAZIOS: Filtros = {
  codigo: "",
  tipo_negocio: "",
  disponibilidade: "",
  cidade: "",
  bairro: "",
  tipo_imovel: "",
  dormitorios_min: "",
  preco_min: "",
  preco_max: "",
  condicao: "",
  mobiliado: "",
};

// ── Labels e badges ────────────────────────────────────────────────────────────

const DISPONIBILIDADE_LABEL: Record<string, { label: string; class: string }> = {
  disponivel: { label: "Disponível", class: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  reservado: { label: "Reservado", class: "bg-amber-50 text-amber-700 ring-amber-200" },
  vendido_locado: { label: "Vendido / Locado", class: "bg-slate-100 text-slate-500 ring-slate-200" },
};

const TIPO_NEGOCIO_LABEL: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Venda e Locação",
};

const TIPO_IMOVEL_LABEL: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
  sala: "Sala",
  galpao: "Galpão",
  loja: "Loja",
  cobertura: "Cobertura",
  kitnet: "Kitnet",
  outro: "Outro",
};

const selectClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const inputClass = selectClass;

// ── Componente principal ──────────────────────────────────────────────────────

export default function ImoveisPage() {
  const router = useRouter();
  const [imoveis, setImoveis] = useState<ImovelListOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buscar = useCallback(async (pg: number, f: Filtros) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pg), page_size: String(PAGE_SIZE) };
      if (f.codigo) params.codigo = f.codigo;
      if (f.tipo_negocio) params.tipo_negocio = f.tipo_negocio;
      if (f.disponibilidade) params.disponibilidade = f.disponibilidade;
      if (f.cidade) params.cidade = f.cidade;
      if (f.bairro) params.bairro = f.bairro;
      if (f.tipo_imovel) params.tipo_imovel = f.tipo_imovel;
      if (f.dormitorios_min) params.dormitorios_min = f.dormitorios_min;
      if (f.preco_min) params.preco_min = f.preco_min;
      if (f.preco_max) params.preco_max = f.preco_max;
      if (f.condicao) params.condicao = f.condicao;
      if (f.mobiliado) params.mobiliado = f.mobiliado;

      const res = await api.get<ImovelListOut[]>("/imoveis/", { params });
      setImoveis(res.data);
      setTotal(Number(res.headers["x-total-count"] ?? res.data.length));
    } catch {
      toast.error("Erro ao carregar imóveis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    buscar(page, filtros);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function confirmarDelecao(id: string, codigo: string) {
    if (!confirm(`Excluir o imóvel ${codigo}? Esta ação não pode ser desfeita.`)) return;
    setDeletandoId(id);
    try {
      await api.delete(`/imoveis/${id}`);
      toast.success("Imóvel excluído com sucesso.");
      buscar(page, filtros);
    } catch {
      toast.error("Erro ao excluir imóvel.");
    } finally {
      setDeletandoId(null);
    }
  }

  const temFiltrosAtivos = Object.values(filtros).some(Boolean);

  function precoDisplay(imovel: ImovelListOut): string {
    if (imovel.tipo_negocio === "venda" && imovel.valor_venda) return formatarMoeda(imovel.valor_venda);
    if (imovel.tipo_negocio === "locacao" && imovel.valor_locacao) return `${formatarMoeda(imovel.valor_locacao)}/mês`;
    if (imovel.tipo_negocio === "ambos") {
      const partes = [];
      if (imovel.valor_venda) partes.push(formatarMoeda(imovel.valor_venda));
      if (imovel.valor_locacao) partes.push(`${formatarMoeda(imovel.valor_locacao)}/mês`);
      return partes.join(" · ") || "—";
    }
    return "—";
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Imóveis</h1>
          <p className="text-slate-500 text-sm">
            {loading ? "Carregando..." : `${total} imóvel${total !== 1 ? "is" : ""} cadastrado${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              filtrosAbertos || temFiltrosAtivos
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {temFiltrosAtivos && (
              <span className="ml-0.5 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          <Link
            href="/imoveis/novo"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
          >
            + Novo imóvel
          </Link>
        </div>
      </div>

      {/* Painel de filtros */}
      {filtrosAbertos && (
        <form
          onSubmit={aplicarFiltros}
          className="bg-white rounded-xl border border-slate-200 p-5 mb-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Código</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={filtros.codigo}
                  onChange={(e) => setFiltros((f) => ({ ...f, codigo: e.target.value }))}
                  className={inputClass + " pl-8"}
                  placeholder="IMO-00001"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de negócio</label>
              <select
                value={filtros.tipo_negocio}
                onChange={(e) => setFiltros((f) => ({ ...f, tipo_negocio: e.target.value }))}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="venda">Venda</option>
                <option value="locacao">Locação</option>
                <option value="ambos">Venda e Locação</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Disponibilidade</label>
              <select
                value={filtros.disponibilidade}
                onChange={(e) => setFiltros((f) => ({ ...f, disponibilidade: e.target.value }))}
                className={selectClass}
              >
                <option value="">Todas</option>
                <option value="disponivel">Disponível</option>
                <option value="reservado">Reservado</option>
                <option value="vendido_locado">Vendido / Locado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de imóvel</label>
              <select
                value={filtros.tipo_imovel}
                onChange={(e) => setFiltros((f) => ({ ...f, tipo_imovel: e.target.value }))}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="casa">Casa</option>
                <option value="apartamento">Apartamento</option>
                <option value="terreno">Terreno</option>
                <option value="sala">Sala comercial</option>
                <option value="galpao">Galpão</option>
                <option value="loja">Loja</option>
                <option value="cobertura">Cobertura</option>
                <option value="kitnet">Kitnet / Studio</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cidade</label>
              <input
                value={filtros.cidade}
                onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
                className={inputClass}
                placeholder="Nome da cidade"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Bairro</label>
              <input
                value={filtros.bairro}
                onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
                className={inputClass}
                placeholder="Nome do bairro"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Condição</label>
              <select
                value={filtros.condicao}
                onChange={(e) => setFiltros((f) => ({ ...f, condicao: e.target.value }))}
                className={selectClass}
              >
                <option value="">Todas</option>
                <option value="usado">Usado</option>
                <option value="novo">Novo</option>
                <option value="em_construcao">Em construção</option>
                <option value="na_planta">Na planta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mobiliado</label>
              <select
                value={filtros.mobiliado}
                onChange={(e) => setFiltros((f) => ({ ...f, mobiliado: e.target.value }))}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
                <option value="semi-mobiliado">Semi-mobiliado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Dormitórios (mín.)</label>
              <select
                value={filtros.dormitorios_min}
                onChange={(e) => setFiltros((f) => ({ ...f, dormitorios_min: e.target.value }))}
                className={selectClass}
              >
                <option value="">Qualquer</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Preço mínimo (R$)</label>
              <input
                type="number"
                min={0}
                value={filtros.preco_min}
                onChange={(e) => setFiltros((f) => ({ ...f, preco_min: e.target.value }))}
                className={inputClass}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Preço máximo (R$)</label>
              <input
                type="number"
                min={0}
                value={filtros.preco_max}
                onChange={(e) => setFiltros((f) => ({ ...f, preco_max: e.target.value }))}
                className={inputClass}
                placeholder="Sem limite"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
            {temFiltrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition"
              >
                <X className="w-3.5 h-3.5" /> Limpar filtros
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              Carregando imóveis...
            </div>
          </div>
        ) : imoveis.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400 text-sm">
              {temFiltrosAtivos ? "Nenhum imóvel encontrado com os filtros aplicados." : "Nenhum imóvel cadastrado ainda."}
            </p>
            {!temFiltrosAtivos && (
              <Link
                href="/imoveis/novo"
                className="inline-block mt-3 text-sm text-blue-600 hover:underline"
              >
                Cadastrar primeiro imóvel
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Foto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Imóvel</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cidade / Bairro</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Disponibilidade</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Preço</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {imoveis.map((imovel) => {
                  const disp = DISPONIBILIDADE_LABEL[imovel.disponibilidade];
                  return (
                    <tr key={imovel.id} className="hover:bg-slate-50 transition">
                      {/* Foto — oculta no mobile */}
                      <td className="hidden md:table-cell px-4 py-3">
                        {imovel.foto_capa ? (
                          <img
                            src={imovel.foto_capa}
                            alt=""
                            className="w-12 h-9 object-cover rounded-md border border-slate-100"
                          />
                        ) : (
                          <div className="w-12 h-9 bg-slate-100 rounded-md flex items-center justify-center text-slate-300 text-xs">
                            —
                          </div>
                        )}
                      </td>

                      {/* Código + Tipo + Preço (mobile) */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-800">{imovel.codigo}</span>
                        <p className="font-medium text-slate-700 text-xs mt-0.5">{TIPO_IMOVEL_LABEL[imovel.tipo_imovel] ?? imovel.tipo_imovel} · {TIPO_NEGOCIO_LABEL[imovel.tipo_negocio]}</p>
                        <p className="sm:hidden text-xs text-slate-500 mt-0.5">{precoDisplay(imovel)}</p>
                      </td>

                      {/* Cidade — oculta no mobile */}
                      <td className="hidden md:table-cell px-4 py-3">
                        <p className="text-slate-800">{imovel.cidade}</p>
                        <p className="text-xs text-slate-400">{imovel.bairro}</p>
                      </td>

                      {/* Disponibilidade */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${disp.class}`}>
                          {disp.label}
                        </span>
                      </td>

                      {/* Preço — oculto no mobile (já aparece na célula Imóvel) */}
                      <td className="hidden sm:table-cell px-4 py-3">
                        <span className="font-medium text-slate-800">{precoDisplay(imovel)}</span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/imoveis/${imovel.id}`)}
                            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmarDelecao(imovel.id, imovel.codigo)}
                            disabled={deletandoId === imovel.id}
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-40"
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

        {/* Paginação */}
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
                    className={`w-7 h-7 text-xs rounded-md transition ${
                      pg === page
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
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
    </div>
  );
}
