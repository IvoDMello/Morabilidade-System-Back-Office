"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, BedDouble, Bath,
  Car, Maximize2, Pencil, Info as InfoIcon,
  LayoutList, Map, Building2, Trash2, Download,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatarMoeda } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { ImovelListOut } from "@/types";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Filtros {
  busca: string;
  codigo: string;
  tipo_negocio: string;
  disponibilidade: string;
  cidade: string;
  bairro: string;
  tipo_imovel: string;
  preco_min: string;
  preco_max: string;
}

const FILTROS_VAZIOS: Filtros = {
  busca: "",
  codigo: "",
  tipo_negocio: "",
  disponibilidade: "",
  cidade: "",
  bairro: "",
  tipo_imovel: "",
  preco_min: "",
  preco_max: "",
};

// ── Labels ─────────────────────────────────────────────────────────────────────

const DISP_BAR: Record<string, string> = {
  disponivel: "bg-emerald-500",
  reservado: "bg-amber-500",
  vendido_locado: "bg-slate-300",
};

const DISP_BADGE: Record<string, { label: string; class: string }> = {
  disponivel: { label: "Disponível", class: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  reservado: { label: "Reservado", class: "bg-amber-50 text-amber-700 ring-amber-200" },
  vendido_locado: { label: "Vendido/Locado", class: "bg-slate-100 text-slate-500 ring-slate-200" },
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

const inputCls =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/30 focus:border-[#585a4f] placeholder:text-slate-400";

// ── Componente principal ──────────────────────────────────────────────────────

export default function ImoveisPage() {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.user?.perfil === "admin");
  const [imoveis, setImoveis] = useState<ImovelListOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [deletando, setDeletando] = useState<{ id: string; codigo: string } | null>(null);
  const [deletandoLoading, setDeletandoLoading] = useState(false);
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    setExportando(true);
    try {
      const res = await api.get("/imoveis/exportar", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `imoveis-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buscar = useCallback(async (pg: number, f: Filtros) => {
setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pg), page_size: String(PAGE_SIZE) };
      const busca = f.busca || f.codigo;
      if (busca) params.codigo = busca;
      if (f.tipo_negocio) params.tipo_negocio = f.tipo_negocio;
      if (f.disponibilidade) params.disponibilidade = f.disponibilidade;
      if (f.cidade) params.cidade = f.cidade;
      if (f.bairro) params.bairro = f.bairro;
      if (f.tipo_imovel) params.tipo_imovel = f.tipo_imovel;
      if (f.preco_min) params.preco_min = f.preco_min;
      if (f.preco_max) params.preco_max = f.preco_max;

      const res = await api.get<ImovelListOut[]>("/imoveis/", { params });
      setImoveis(res.data);
      setTotal(Number(res.headers["x-total-count"] ?? res.data.length));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      console.error("[imoveis] erro ao carregar (status=%s):", status, err);
      if (status === 401 || status === 403) {
        toast.error(`Sessão inválida (${status}). Saia e entre novamente.`);
      } else if (status === 502) {
        toast.error("API indisponível. Tente mais tarde.");
      } else {
        toast.error("Erro ao carregar imóveis.");
      }
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
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setPage(1);
    buscar(1, FILTROS_VAZIOS);
  }

  async function handleDeletar() {
    if (!deletando) return;
    setDeletandoLoading(true);
    try {
      await api.delete(`/imoveis/${deletando.id}`);
      toast.success("Imóvel excluído com sucesso.");
      setDeletando(null);
      buscar(page, filtros);
    } catch {
      toast.error("Erro ao excluir imóvel.");
    } finally {
      setDeletandoLoading(false);
    }
  }

  function precoInfo(imovel: ImovelListOut): { tipo: string; valor: string } {
    if (imovel.tipo_negocio === "venda")
      return { tipo: "Venda", valor: imovel.valor_venda ? formatarMoeda(imovel.valor_venda) : "—" };
    if (imovel.tipo_negocio === "locacao")
      return { tipo: "Locação", valor: imovel.valor_locacao ? formatarMoeda(imovel.valor_locacao) : "—" };
    return {
      tipo: "Venda e Locação",
      valor: imovel.valor_venda ? formatarMoeda(imovel.valor_venda) : "—",
    };
  }

  const temFiltrosAtivos = Object.values(filtros).some(Boolean);

  return (
    <div
      className="flex overflow-hidden -m-4 md:-m-6"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {/* ── Sidebar de filtros ── */}
      <aside className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-100 text-slate-700 font-semibold text-sm shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filtros
        </div>

        <form onSubmit={aplicarFiltros} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Busca geral */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                value={filtros.busca}
                onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
                className={inputCls + " pl-9"}
                placeholder="Busque por endereço, código..."
              />
            </div>

            {/* Código */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Código</label>
              <input
                value={filtros.codigo}
                onChange={(e) => setFiltros((f) => ({ ...f, codigo: e.target.value }))}
                className={inputCls}
                placeholder="Informe um código"
              />
            </div>

            {/* Contrato */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contrato</label>
              <div className="flex gap-4">
                {(["venda", "locacao"] as const).map((tipo) => (
                  <label key={tipo} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtros.tipo_negocio === tipo}
                      onChange={() =>
                        setFiltros((f) => ({ ...f, tipo_negocio: f.tipo_negocio === tipo ? "" : tipo }))
                      }
                      className="w-4 h-4 rounded border-slate-300 accent-[#585a4f]"
                    />
                    {tipo === "venda" ? "Venda" : "Locação"}
                  </label>
                ))}
              </div>
            </div>

            {/* Disponibilidade */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Disponibilidade</label>
              <select
                value={filtros.disponibilidade}
                onChange={(e) => setFiltros((f) => ({ ...f, disponibilidade: e.target.value }))}
                className={inputCls}
              >
                <option value="">Disponível, negociado, etc...</option>
                <option value="disponivel">Disponível</option>
                <option value="reservado">Reservado</option>
                <option value="vendido_locado">Vendido / Locado</option>
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo</label>
              <select
                value={filtros.tipo_imovel}
                onChange={(e) => setFiltros((f) => ({ ...f, tipo_imovel: e.target.value }))}
                className={inputCls}
              >
                <option value="">Apartamento, casa, etc...</option>
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

            {/* Cidade */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cidade - UF</label>
              <input
                value={filtros.cidade}
                onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
                className={inputCls}
                placeholder="Digite a cidade"
              />
            </div>

            {/* Bairro */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bairro</label>
              <input
                value={filtros.bairro}
                onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
                className={inputCls}
                placeholder="Digite o bairro"
              />
            </div>

            {/* Valores */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Valores (R$)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={filtros.preco_min}
                  onChange={(e) => setFiltros((f) => ({ ...f, preco_min: e.target.value }))}
                  className={inputCls}
                  placeholder="Mín."
                />
                <input
                  type="number"
                  min={0}
                  value={filtros.preco_max}
                  onChange={(e) => setFiltros((f) => ({ ...f, preco_max: e.target.value }))}
                  className={inputCls}
                  placeholder="Máx."
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="shrink-0 p-4 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={limparFiltros}
              className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white transition hover:opacity-90"
              style={{ backgroundColor: "#585a4f" }}
            >
              Filtrar
            </button>
          </div>
        </form>
      </aside>

      {/* ── Painel direito ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#585a4f]" />
            <h1 className="text-sm font-semibold text-slate-800">
              Imóveis {!loading && `(${total})`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <button className="p-1.5 bg-slate-100 text-slate-600" title="Lista">
                <LayoutList className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-slate-400 hover:bg-slate-50 transition" title="Mapa">
                <Map className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleExportar}
              disabled={exportando || total === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border bg-white border-slate-200 text-slate-600 hover:border-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Baixa todos os imóveis em CSV"
            >
              <Download className="w-4 h-4" />
              {exportando ? "Exportando..." : "Exportar CSV"}
            </button>
            {isAdmin && (
              <Link
                href="/imoveis/novo"
                className="px-4 py-2 text-white text-sm font-medium rounded-lg transition hover:opacity-90"
                style={{ backgroundColor: "#585a4f" }}
              >
                + Novo imóvel
              </Link>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-[#585a4f] rounded-full animate-spin" />
              Carregando imóveis...
            </div>
          ) : imoveis.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Building2 className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-medium text-slate-500">
                {temFiltrosAtivos
                  ? "Nenhum imóvel encontrado com os filtros aplicados."
                  : "Nenhum imóvel cadastrado ainda."}
              </p>
              {!temFiltrosAtivos && (
                <Link
                  href="/imoveis/novo"
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#585a4f" }}
                >
                  Cadastrar primeiro imóvel →
                </Link>
              )}
            </div>
          ) : (
            imoveis.map((imovel) => {
              const { tipo, valor } = precoInfo(imovel);
              const barColor = DISP_BAR[imovel.disponibilidade] ?? "bg-slate-300";

              return (
                <div
                  key={imovel.id}
                  className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition overflow-hidden"
                >
                  {/* Linha de ações */}
                  <div className="flex items-center justify-end gap-1 px-4 pt-3 pb-2 border-b border-slate-50">
                    <button
                      onClick={() => router.push(`/imoveis/${imovel.id}`)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-[#585a4f] hover:bg-slate-50 rounded-md transition"
                      title={isAdmin ? "Editar" : "Visualizar"}
                    >
                      {isAdmin ? (
                        <>
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </>
                      ) : (
                        <>
                          <InfoIcon className="w-3.5 h-3.5" /> Detalhes
                        </>
                      )}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setDeletando({ id: imovel.id, codigo: imovel.codigo })}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Conteúdo do card */}
                  <div className="flex items-stretch px-4 py-4 gap-4">
                    {/* Barra de status + foto */}
                    <div className="flex gap-3 shrink-0">
                      <div className={`w-1 rounded-full self-stretch ${barColor}`} />
                      <div className="relative w-44 h-32 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        {imovel.foto_capa ? (
                          <img
                            src={imovel.foto_capa}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-slate-300" />
                          </div>
                        )}
                        <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded font-mono font-semibold">
                          {imovel.codigo}
                        </span>
                        {imovel.destaque_ordem != null && (
                          <span
                            className="absolute top-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 shadow"
                            style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
                            title={`Destaque na home — posição ${imovel.destaque_ordem}`}
                          >
                            ★ #{imovel.destaque_ordem}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info do imóvel */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                          {imovel.logradouro}{imovel.numero ? `, ${imovel.numero}` : ""}
                        </p>
                        {DISP_BADGE[imovel.disponibilidade] && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ${DISP_BADGE[imovel.disponibilidade].class}`}
                          >
                            {DISP_BADGE[imovel.disponibilidade].label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {TIPO_IMOVEL_LABEL[imovel.tipo_imovel] ?? imovel.tipo_imovel}
                      </p>
                      <p className="text-sm text-slate-600">{imovel.bairro}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: "#585a4f" }}>
                        {imovel.cidade}
                      </p>

                      {/* Proprietário (se cadastrado) */}
                      {imovel.proprietario && (
                        <p className="text-xs text-slate-500 mt-1.5">
                          <span className="text-slate-400">Proprietário:</span>{" "}
                          <span className="font-medium text-slate-700">{imovel.proprietario.nome_completo}</span>
                          <span className="text-slate-400"> · {imovel.proprietario.telefone}</span>
                        </p>
                      )}

                      {/* Especificações */}
                      <div className="flex items-center gap-4 mt-3 text-slate-500">
                        {imovel.dormitorios != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <BedDouble className="w-3.5 h-3.5" />
                            {imovel.dormitorios}
                            {imovel.suites != null && imovel.suites > 0 && (
                              <span className="text-slate-400">({imovel.suites})</span>
                            )}
                          </span>
                        )}
                        {imovel.banheiros != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <Bath className="w-3.5 h-3.5" />
                            {imovel.banheiros}
                          </span>
                        )}
                        {imovel.vagas_garagem != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <Car className="w-3.5 h-3.5" />
                            {imovel.vagas_garagem}
                          </span>
                        )}
                        {imovel.area_util != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <Maximize2 className="w-3.5 h-3.5" />
                            {imovel.area_util} m²
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Preço */}
                    <div className="shrink-0 text-right min-w-[140px]">
                      <p className="text-xs font-medium text-slate-400">{tipo}</p>
                      <p className="text-base font-bold text-slate-900">{valor}</p>
                      {imovel.condominio_mensal != null && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-400">Condomínio</p>
                          <p className="text-sm font-medium text-slate-700">
                            {formatarMoeda(imovel.condominio_mensal)}
                          </p>
                        </div>
                      )}
                      {imovel.iptu_mensal != null && (
                        <div className="mt-1">
                          <p className="text-xs text-slate-400">IPTU (mensal)</p>
                          <p className="text-sm font-medium text-slate-700">
                            {formatarMoeda(imovel.iptu_mensal)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Seta */}
                    <div className="flex items-center text-slate-300 shrink-0">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Paginação */}
        {!loading && total > PAGE_SIZE && (
          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white">
            <p className="text-xs text-slate-500">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {((): (number | "...")[] => {
                if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
                const pages: (number | "...")[] = [1];
                if (page > 3) pages.push("...");
                for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
                if (page < totalPages - 2) pages.push("...");
                pages.push(totalPages);
                return pages;
              })().map((pg, i) =>
                pg === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-300 text-xs select-none">···</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => setPage(pg as number)}
                    className="w-7 h-7 text-xs rounded-md transition font-medium text-slate-600 hover:bg-slate-100"
                    style={pg === page ? { backgroundColor: "#585a4f", color: "#fff" } : undefined}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      <ConfirmDialog
        open={!!deletando}
        onOpenChange={(open) => { if (!open) setDeletando(null); }}
        title="Excluir imóvel"
        description={`Tem certeza que deseja excluir o imóvel ${deletando?.codigo ?? ""}? Esta ação não pode ser desfeita.`}
        loading={deletandoLoading}
        onConfirm={handleDeletar}
      />
    </div>
  );
}
