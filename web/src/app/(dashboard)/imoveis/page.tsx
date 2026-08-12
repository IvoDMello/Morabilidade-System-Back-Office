"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, BedDouble, Bath,
  Car, Maximize2, Pencil, Info as InfoIcon,
  LayoutList, Map, Building2, Trash2, Download, Filter, X, Instagram,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { formatarMoeda } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FiltroSelect } from "@/components/ui/FiltroSelect";
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
  sem_foto: boolean;
}

// Cidades e bairros já cadastrados, vindos de GET /imoveis/localidades.
interface Localidades {
  cidades: string[];
  bairros: string[];
  bairros_por_cidade: Record<string, string[]>;
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
  sem_foto: false,
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
  casa_vila: "Casa de vila",
  casa_condominio: "Casa de condomínio",
  apartamento: "Apartamento",
  cobertura: "Cobertura",
};

// ── Estilo do painel de filtros (paleta creme do redesign) ────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 text-sm border border-[#e8e5da] rounded-xl bg-[#ffffff] text-[#26241c] " +
  "focus:outline-none focus:ring-2 focus:ring-[#585a4f]/25 focus:border-[#585a4f] " +
  "placeholder:text-[#a49d8b] transition-colors";

// Rótulo de seção: caps pequeno com tracking largo.
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#938d7c] mb-2";

// ── Máscara de moeda (filtro de valores) ──────────────────────────────────────
// O estado guarda só dígitos ("1500000"); a tela mostra com separador de
// milhar ("1.500.000"), o que torna visível um zero a mais ou a menos.

function apenasDigitos(s: string): string {
  return s.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
}

function formatarMilhar(digitos: string): string {
  return digitos ? Number(digitos).toLocaleString("pt-BR") : "";
}

// Checagem de formato (sem rede): o link é um post/reel/tv do Instagram?
// Posts/reels têm URL permanente, só não detectamos se o post foi apagado lá.
function instagramLinkValido(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return false;
    return /^\/(p|reel|reels|tv)\/[\w-]+/i.test(u.pathname);
  } catch {
    return false;
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ImoveisPage() {
  return (
    <Suspense fallback={null}>
      <ImoveisPageInner />
    </Suspense>
  );
}

function ImoveisPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = useAuthStore((s) => (s.user?.perfil === "admin" || s.user?.perfil === "corretor"));
  const [imoveis, setImoveis] = useState<ImovelListOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ...FILTROS_VAZIOS,
    codigo: searchParams.get("codigo") ?? "",
    disponibilidade: searchParams.get("disponibilidade") ?? "",
    tipo_imovel: searchParams.get("tipo_imovel") ?? "",
    sem_foto: searchParams.get("sem_foto") === "1",
  }));
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [localidades, setLocalidades] = useState<Localidades | null>(null);
  // Se a busca das localidades falhar, os selects viram inputs de texto para
  // o filtro não ficar inutilizável.
  const [localidadesErro, setLocalidadesErro] = useState(false);
  const [deletando, setDeletando] = useState<{ id: string; codigo: string } | null>(null);
  const [deletandoLoading, setDeletandoLoading] = useState(false);
  const [exportando, setExportando] = useState(false);

  async function handleExportar() {
    setExportando(true);
    try {
      const params: Record<string, string> = {};
      if (filtros.busca) params.q = filtros.busca;
      if (filtros.codigo) params.codigo = filtros.codigo;
      if (filtros.tipo_negocio) params.tipo_negocio = filtros.tipo_negocio;
      if (filtros.disponibilidade) params.disponibilidade = filtros.disponibilidade;
      if (filtros.cidade) params.cidade = filtros.cidade;
      if (filtros.bairro) params.bairro = filtros.bairro;
      if (filtros.tipo_imovel) params.tipo_imovel = filtros.tipo_imovel;
      if (filtros.preco_min) params.preco_min = filtros.preco_min;
      if (filtros.preco_max) params.preco_max = filtros.preco_max;
      if (filtros.sem_foto) params.sem_foto = "true";
      const res = await api.get("/imoveis/exportar", { responseType: "blob", params });
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
      if (f.busca) params.q = f.busca;
      if (f.codigo) params.codigo = f.codigo;
      if (f.tipo_negocio) params.tipo_negocio = f.tipo_negocio;
      if (f.disponibilidade) params.disponibilidade = f.disponibilidade;
      if (f.cidade) params.cidade = f.cidade;
      if (f.bairro) params.bairro = f.bairro;
      if (f.tipo_imovel) params.tipo_imovel = f.tipo_imovel;
      if (f.preco_min) params.preco_min = f.preco_min;
      if (f.preco_max) params.preco_max = f.preco_max;
      if (f.sem_foto) params.sem_foto = "true";

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

  useEffect(() => {
    api
      .get<Localidades>("/imoveis/localidades")
      .then((res) => setLocalidades(res.data))
      .catch(() => setLocalidadesErro(true));
  }, []);

  // Com cidade escolhida, só os bairros dela; sem cidade, todos.
  const bairrosDisponiveis = useMemo(() => {
    if (!localidades) return [];
    return filtros.cidade
      ? localidades.bairros_por_cidade[filtros.cidade] ?? []
      : localidades.bairros;
  }, [localidades, filtros.cidade]);

  function selecionarCidade(cidade: string) {
    const permitidos = cidade
      ? localidades?.bairros_por_cidade[cidade] ?? []
      : localidades?.bairros ?? [];
    setPage(1);
    setFiltros((f) => ({
      ...f,
      cidade,
      // Bairro que não existe na cidade nova zeraria a busca sem o usuário ver.
      bairro: permitidos.includes(f.bairro) ? f.bairro : "",
    }));
  }

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
      if (imoveis.length === 1 && page > 1) {
        setPage((p) => p - 1); // useEffect re-fetches página anterior
      } else {
        buscar(page, filtros);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erro ao excluir imóvel.";
      toast.error(detail);
    } finally {
      setDeletandoLoading(false);
    }
  }

  function precoInfo(imovel: ImovelListOut): { tipo: string; valor: string } {
    if (imovel.tipo_negocio === "venda")
      return { tipo: "Venda", valor: imovel.valor_venda ? formatarMoeda(imovel.valor_venda) : "-" };
    if (imovel.tipo_negocio === "locacao")
      return { tipo: "Locação", valor: imovel.valor_locacao ? formatarMoeda(imovel.valor_locacao) : "-" };
    return {
      tipo: "Venda e Locação",
      valor: imovel.valor_venda ? formatarMoeda(imovel.valor_venda) : "-",
    };
  }

  const temFiltrosAtivos = Object.values(filtros).some(Boolean);

  return (
    <div
      className={[
        "flex overflow-hidden -m-4 md:-m-6 md:-mb-10",
        // Mobile: altura da viewport menos o header.
        // Desktop: o <main> já tem altura definida; ocupamos a área de conteúdo
        // dele mais o padding que cancelamos com as margens negativas
        // (24px em cima + 40px embaixo), para não gerar scroll extra na página.
        "h-[calc(100vh-64px)] md:h-[calc(100%+4rem)]",
      ].join(" ")}
    >
      {/* Backdrop mobile, começa abaixo do header (top-16 = 64px) */}
      {filtrosOpen && (
        <div
          className="fixed top-16 inset-x-0 bottom-0 bg-black/40 z-20 md:hidden"
          onClick={() => setFiltrosOpen(false)}
        />
      )}

      {/* ── Sidebar de filtros ── */}
      <aside
        className={[
          "w-72 shrink-0 bg-[#fbfaf7] border-r border-[#ebe9df] flex flex-col overflow-hidden",
          "fixed top-16 left-0 bottom-0 z-30 transition-transform duration-200",
          filtrosOpen ? "translate-x-0" : "-translate-x-full",
          "md:relative md:top-auto md:bottom-auto md:z-auto md:translate-x-0",
        ].join(" ")}
      >
        {/* Header mobile */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eeece3] md:hidden">
          <span className="text-[#26241c] font-bold text-base">Filtros</span>
          <button onClick={() => setFiltrosOpen(false)} className="p-1 text-[#938d7c] hover:text-[#26241c] rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Header desktop */}
        <div className="hidden md:flex items-center px-5 py-4 border-b border-[#eeece3] text-[#26241c] font-bold text-base shrink-0">
          Filtros
        </div>

        <form onSubmit={aplicarFiltros} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Busca geral */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a49d8b]" />
              <input
                value={filtros.busca}
                onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
                className={inputCls + " pl-10"}
                placeholder="Busque por endereço, código..."
              />
            </div>

            {/* Código */}
            <input
              value={filtros.codigo}
              onChange={(e) => setFiltros((f) => ({ ...f, codigo: e.target.value }))}
              className={inputCls}
              placeholder="Código do imóvel"
            />

            {/* Contrato */}
            <div>
              <label className={labelCls}>Contrato</label>
              <div className="grid grid-cols-2 gap-2">
                {(["venda", "locacao"] as const).map((tipo) => {
                  const ativo = filtros.tipo_negocio === tipo;
                  return (
                    <button
                      key={tipo}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() =>
                        setFiltros((f) => ({ ...f, tipo_negocio: f.tipo_negocio === tipo ? "" : tipo }))
                      }
                      className={
                        "py-2.5 text-sm font-medium rounded-xl border transition " +
                        (ativo
                          ? "bg-[#26241c] text-white border-[#26241c]"
                          : "bg-white text-[#4a473d] border-[#e8e5da] hover:border-[#d5d0c0]")
                      }
                    >
                      {tipo === "venda" ? "Venda" : "Locação"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Disponibilidade */}
            <div>
              <label className={labelCls}>Disponibilidade</label>
              <FiltroSelect
                value={filtros.disponibilidade}
                onChange={(disponibilidade) => setFiltros((f) => ({ ...f, disponibilidade }))}
                todosLabel="Todos"
                options={[
                  { value: "disponivel", label: "Disponível" },
                  { value: "reservado", label: "Reservado" },
                  { value: "vendido_locado", label: "Vendido / Locado" },
                ]}
              />
            </div>

            {/* Tipo */}
            <div>
              <label className={labelCls}>Tipo</label>
              <FiltroSelect
                value={filtros.tipo_imovel}
                onChange={(tipo_imovel) => setFiltros((f) => ({ ...f, tipo_imovel }))}
                todosLabel="Todos os tipos"
                options={Object.entries(TIPO_IMOVEL_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </div>

            {/* Localização: cidade + bairro */}
            <div>
              <label className={labelCls}>Localização</label>
              <div className="space-y-2">
                {localidadesErro ? (
                  <>
                    <input
                      value={filtros.cidade}
                      onChange={(e) => setFiltros((f) => ({ ...f, cidade: e.target.value }))}
                      className={inputCls}
                      placeholder="Digite a cidade"
                    />
                    <input
                      value={filtros.bairro}
                      onChange={(e) => setFiltros((f) => ({ ...f, bairro: e.target.value }))}
                      className={inputCls}
                      placeholder="Digite o bairro"
                    />
                  </>
                ) : (
                  <>
                    <FiltroSelect
                      value={filtros.cidade}
                      onChange={selecionarCidade}
                      disabled={!localidades}
                      todosLabel={localidades ? "Todas as cidades" : "Carregando..."}
                      options={(localidades?.cidades ?? []).map((c) => ({ value: c, label: c }))}
                    />
                    <FiltroSelect
                      value={filtros.bairro}
                      onChange={(bairro) => {
                        setPage(1);
                        setFiltros((f) => ({ ...f, bairro }));
                      }}
                      disabled={bairrosDisponiveis.length === 0}
                      todosLabel={
                        !localidades
                          ? "Carregando..."
                          : bairrosDisponiveis.length === 0
                            ? "Nenhum bairro cadastrado"
                            : "Todos os bairros"
                      }
                      options={bairrosDisponiveis.map((b) => ({ value: b, label: b }))}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Faixa de valor */}
            <div>
              <label className={labelCls}>Faixa de valor</label>
              <div className="flex items-center gap-2">
                {([
                  ["preco_min", "Mínimo"],
                  ["preco_max", "Máximo"],
                ] as const).map(([campo, placeholder], i) => (
                  <div key={campo} className="contents">
                    {i > 0 && <span className="shrink-0 text-[#a49d8b] select-none">–</span>}
                    <div className="relative flex-1 min-w-0">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#a49d8b]">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatarMilhar(filtros[campo])}
                        onChange={(e) => {
                          const digitos = apenasDigitos(e.target.value);
                          setFiltros((f) => ({ ...f, [campo]: digitos }));
                        }}
                        className={inputCls + " pl-8 tabular-nums"}
                        placeholder={placeholder}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {filtros.preco_min && filtros.preco_max &&
                Number(filtros.preco_min) > Number(filtros.preco_max) && (
                <p className="mt-1.5 text-[11px] text-amber-600">
                  O valor mínimo está maior que o máximo — confira os zeros.
                </p>
              )}
            </div>

            {/* Sem foto */}
            <button
              type="button"
              role="switch"
              aria-checked={filtros.sem_foto}
              onClick={() => setFiltros((f) => ({ ...f, sem_foto: !f.sem_foto }))}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-[#e8e5da] hover:border-[#d5d0c0] transition text-left"
            >
              <span className="text-sm text-[#4a473d]">Apenas imóveis sem foto</span>
              <span
                className={
                  "relative shrink-0 w-10 h-[22px] rounded-full transition-colors " +
                  (filtros.sem_foto ? "bg-[#585a4f]" : "bg-[#dcd8ca]")
                }
              >
                <span
                  className={
                    "absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform " +
                    (filtros.sem_foto ? "translate-x-[18px]" : "")
                  }
                />
              </span>
            </button>
          </div>

          {/* Botões */}
          <div className="shrink-0 p-4 border-t border-[#eeece3] flex gap-2">
            <button
              type="button"
              onClick={limparFiltros}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-[#e8e5da] rounded-xl text-[#4a473d] bg-white hover:bg-[#f7f6f1] transition"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="flex-[1.6] px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-[#26241c] hover:bg-[#3a372c] transition"
            >
              Filtrar
            </button>
          </div>
        </form>
      </aside>

      {/* ── Painel direito ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3.5 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              onClick={() => setFiltrosOpen(true)}
              title="Filtros"
            >
              <Filter className="w-4 h-4" />
            </button>
            <Building2 className="w-5 h-5 text-[#585a4f]" />
            <h1 className="text-sm font-semibold text-slate-800">
              Imóveis {!loading && `(${total})`}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <div className="hidden sm:flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
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
              <span className="hidden sm:inline">{exportando ? "Exportando..." : "Exportar CSV"}</span>
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
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-slate-200 overflow-hidden animate-pulse">
                  <div className="h-8 bg-slate-100 border-b border-slate-50" />
                  <div className="flex items-stretch px-4 py-4 gap-4">
                    <div className="flex gap-3 shrink-0">
                      <div className="w-1 rounded-full bg-slate-200" />
                      <div className="hidden sm:block sm:w-36 sm:h-28 md:w-44 md:h-32 rounded-lg bg-slate-200" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2 py-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                      <div className="flex gap-3 mt-4">
                        <div className="h-3 w-12 bg-slate-100 rounded" />
                        <div className="h-3 w-12 bg-slate-100 rounded" />
                        <div className="h-3 w-16 bg-slate-100 rounded" />
                      </div>
                    </div>
                    <div className="shrink-0 w-24 space-y-1 py-1">
                      <div className="h-3 bg-slate-100 rounded w-full" />
                      <div className="h-5 bg-slate-200 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
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
                  onClick={() => router.push(`/imoveis/${imovel.id}`)}
                  className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition overflow-hidden cursor-pointer"
                >
                  {/* Linha de ações */}
                  <div className="flex items-center justify-end gap-1 px-4 pt-3 pb-2 border-b border-slate-50">
                    {imovel.instagram_url && (() => {
                      const valido = instagramLinkValido(imovel.instagram_url);
                      return (
                        <a
                          href={imovel.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`mr-auto p-1.5 rounded-md transition ${
                            valido
                              ? "text-pink-500 hover:bg-pink-50"
                              : "text-amber-500 hover:bg-amber-50"
                          }`}
                          title={
                            valido
                              ? "Anúncio no Instagram, abrir post"
                              : "Link do Instagram preenchido, mas não parece um post válido, verifique"
                          }
                        >
                          <Instagram className="w-3.5 h-3.5" />
                        </a>
                      );
                    })()}
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/imoveis/${imovel.id}`); }}
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
                        onClick={(e) => { e.stopPropagation(); setDeletando({ id: imovel.id, codigo: imovel.codigo }); }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Conteúdo do card */}
                  <div className="flex flex-wrap sm:flex-nowrap items-stretch px-4 py-4 gap-4">
                    {/* Barra de status + foto (foto escondida no mobile) */}
                    <div className="flex gap-3 shrink-0">
                      <div className={`w-1 rounded-full self-stretch ${barColor}`} />
                      <div className="relative hidden sm:block sm:w-36 sm:h-28 md:w-44 md:h-32 rounded-lg overflow-hidden bg-slate-100 shrink-0">
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
                            title={`Destaque na home, posição ${imovel.destaque_ordem}`}
                          >
                            ★ #{imovel.destaque_ordem}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info do imóvel */}
                    <div className="flex-1 min-w-0">
                      {/* Chips mobile: código + destaque (no desktop ficam sobre a foto) */}
                      <div className="flex items-center gap-1.5 mb-1.5 sm:hidden">
                        <span className="inline-flex items-center bg-slate-800 text-white text-xs px-2 py-0.5 rounded font-mono font-semibold">
                          {imovel.codigo}
                        </span>
                        {imovel.destaque_ordem != null && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ backgroundColor: "#d8cb6a", color: "#2e302a" }}
                            title={`Destaque na home, posição ${imovel.destaque_ordem}`}
                          >
                            ★ #{imovel.destaque_ordem}
                          </span>
                        )}
                      </div>
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

                    {/* Preço, empilhado abaixo no mobile, lateral no sm+ */}
                    <div className="w-full sm:w-auto sm:shrink-0 sm:text-right sm:min-w-[140px] order-last sm:order-none border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 flex flex-wrap sm:block items-baseline gap-x-4 gap-y-1">
                      <div>
                        <p className="text-xs font-medium text-slate-400">{tipo}</p>
                        <p className="text-base font-bold text-slate-900">{valor}</p>
                      </div>
                      {imovel.condominio_mensal != null && (
                        <div className="sm:mt-2">
                          <p className="text-xs text-slate-400">Condomínio</p>
                          <p className="text-sm font-medium text-slate-700">
                            {formatarMoeda(imovel.condominio_mensal)}
                          </p>
                        </div>
                      )}
                      {imovel.iptu_mensal != null && (
                        <div className="sm:mt-1">
                          <p className="text-xs text-slate-400">IPTU (mensal)</p>
                          <p className="text-sm font-medium text-slate-700">
                            {formatarMoeda(imovel.iptu_mensal)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Seta, só desktop, decorativa */}
                    <div className="hidden sm:flex items-center text-slate-300 shrink-0">
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
