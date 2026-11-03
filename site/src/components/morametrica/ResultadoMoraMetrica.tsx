"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  DoorOpen,
  Map as MapaIcon,
  MapPin,
  SearchX,
} from "lucide-react";
import type { RadarBusca } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  comFiltros,
  descreverPeriodo,
  formatarArea,
  formatarInteiro,
  formatarM2,
  formatarMes,
  formatarValor,
  novaBusca,
  plural,
  urlMoraMetrica,
  urlSugestao,
  type ParametrosBusca,
} from "@/lib/morametrica";
import { LinkBusca, useNavegacao } from "./Navegacao";

interface Props {
  dados: RadarBusca;
  params: ParametrosBusca;
}

type Transacao = RadarBusca["transacoes"][number];

export function ResultadoMoraMetrica({ dados, params }: Props) {
  const { carregando } = useNavegacao();
  const secao = useRef<HTMLElement>(null);
  const primeiraVez = useRef(true);
  const identidade = [dados.tipo, dados.cl, dados.numero, dados.bairro, dados.consulta].join("|");

  // Busca nova (não filtro) leva a tela até o resultado, se ele estiver fora de
  // vista. No primeiro carregamento (link compartilhado) a página fica no topo.
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    const topo = secao.current?.getBoundingClientRect().top;
    if (topo != null && (topo < 0 || topo > window.innerHeight * 0.5)) {
      secao.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [identidade]);

  return (
    <section
      ref={secao}
      aria-live="polite"
      aria-busy={carregando}
      className={cn(
        "scroll-mt-24 space-y-5 transition-opacity duration-200",
        carregando && "opacity-50 pointer-events-none",
      )}
    >
      {dados.tipo === "ambiguo" && <Opcoes dados={dados} />}
      {dados.tipo === "nenhum" && <Nenhum dados={dados} />}
      {(dados.tipo === "predio" || dados.tipo === "rua" || dados.tipo === "bairro") && (
        <>
          <Cabecalho dados={dados} />
          {/* Unidade: o histórico todo, sem filtros (vende poucas vezes) */}
          {!dados.unidade && <Filtros dados={dados} params={params} />}
          {(dados.resumo?.transacoes ?? 0) === 0 ? (
            dados.unidade ? (
              <UnidadeSemVenda dados={dados} />
            ) : (
              <SemVendasNoPeriodo dados={dados} params={params} />
            )
          ) : (
            <>
              {dados.tipo === "predio" && <ListaTransacoes dados={dados} params={params} />}
              {dados.tipo === "rua" && <ListaPredios dados={dados} params={params} />}
              {dados.tipo === "bairro" && <ResumoBairro key={dados.bairro} dados={dados} params={params} />}
            </>
          )}
        </>
      )}
    </section>
  );
}

// ── Peças comuns ─────────────────────────────────────────────────────────────

const CARTAO = "bg-white rounded-2xl border border-[#e4e1d6] shadow-card";
const ROTULO = "text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a8d3a]";

function Cabecalho({ dados }: { dados: RadarBusca }) {
  const tipo = dados.unidade
    ? { rotulo: "Unidade", Icone: DoorOpen }
    : {
        predio: { rotulo: "Prédio", Icone: Building2 },
        rua: { rotulo: "Logradouro", Icone: MapPin },
        bairro: { rotulo: "Bairro", Icone: MapaIcon },
      }[dados.tipo as "predio" | "rua" | "bairro"];
  const resumo = dados.resumo;
  const detalhes = [
    dados.unidade,
    dados.tipo !== "bairro" ? dados.bairros.slice(0, 3).join(", ") : null,
    dados.apelido,
  ].filter(Boolean);
  const rotuloVendas = dados.unidade ? "Vendas da unidade" : dados.tipo === "rua" ? "Vendas na rua" : "Vendas no período";
  const historicoMaior = dados.total_historico > (resumo?.transacoes ?? 0);

  return (
    <div className={cn(CARTAO, "p-5 sm:p-7")}>
      <p className={cn(ROTULO, "flex items-center gap-2")}>
        <tipo.Icone className="w-3.5 h-3.5" aria-hidden />
        {tipo.rotulo}
      </p>
      <h2 className="font-serif text-[26px] sm:text-[32px] leading-tight text-[#2d2f28] mt-2 break-words">
        {dados.titulo}
      </h2>
      {detalhes.length > 0 && (
        <p className="text-sm text-[#7a7c72] mt-1">{detalhes.join(" · ")}</p>
      )}

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5 mt-6">
        <Indicador
          rotulo={rotuloVendas}
          valor={formatarInteiro(resumo?.transacoes ?? 0)}
        />
        <Indicador
          rotulo="Média do m²"
          valor={formatarValor(resumo?.media_m2)}
          sufixo={resumo?.media_m2 != null ? "/m²" : undefined}
          destaque
        />
        <Indicador rotulo="Média do valor" valor={formatarValor(resumo?.media_valor)} />
        <Indicador rotulo="Média da área" valor={formatarArea(resumo?.media_area)} />
      </dl>

      <p className="text-xs text-[#7a7c72] mt-5 pt-4 border-t border-[#efede5]">
        Período: {descreverPeriodo(dados.periodo, dados.dados_ate)}.
        {historicoMaior && (
          <> No total, {plural(dados.total_historico, "venda registrada", "vendas registradas")} desde 2011.</>
        )}
      </p>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  sufixo,
  destaque,
}: {
  rotulo: string;
  valor: string;
  sufixo?: string;
  destaque?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#7a7c72]">{rotulo}</dt>
      <dd
        className={cn(
          "mt-1 font-semibold tabular-nums whitespace-nowrap",
          destaque ? "text-[20px] sm:text-2xl text-[#3e4037]" : "text-lg sm:text-xl text-[#2d2f28]",
        )}
      >
        {valor}
        {/* "/m²" menor e colado ao número: no celular a coluna tem ~150 px */}
        {sufixo && <span className="text-sm font-medium text-[#7a7c72]">{sufixo}</span>}
      </dd>
    </div>
  );
}

function Chip({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <LinkBusca
      href={href}
      aria-current={ativo ? "true" : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition whitespace-nowrap",
        ativo
          ? "bg-[#585a4f] border-[#585a4f] text-white font-semibold"
          : "bg-white border-[#e4e1d6] text-[#2d2f28] hover:border-[#585a4f]",
      )}
    >
      {children}
    </LinkBusca>
  );
}

function Filtros({ dados, params }: Props) {
  const anoDados = dados.dados_ate ? Number(dados.dados_ate.slice(0, 4)) : new Date().getFullYear();
  const dezAnos = String(anoDados - 9);
  const semAno = { desde: undefined, ate: undefined };
  const periodos = [
    {
      rotulo: "Últimos 5 anos",
      href: comFiltros(params, { ...semAno, todo_periodo: undefined }),
      ativo: !params.todo_periodo && !params.desde && !params.ate,
    },
    {
      rotulo: "Últimos 10 anos",
      href: comFiltros(params, { ...semAno, desde: dezAnos, todo_periodo: undefined }),
      ativo: !params.todo_periodo && params.desde === dezAnos && !params.ate,
    },
    {
      rotulo: "Desde 2011",
      href: comFiltros(params, { ...semAno, todo_periodo: "true" }),
      ativo: params.todo_periodo === "true",
    },
  ];
  const tipologias = dados.tipologias.slice(0, 8);

  return (
    <div className={cn(CARTAO, "p-4 sm:p-5 space-y-4")}>
      <div>
        <p className="text-xs font-semibold text-[#7a7c72] mb-2">Período</p>
        <div className="flex flex-wrap gap-2">
          {periodos.map((p) => (
            <Chip key={p.rotulo} href={p.href} ativo={p.ativo}>
              {p.rotulo}
            </Chip>
          ))}
        </div>
      </div>
      {tipologias.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-[#7a7c72] mb-2">Tipologia</p>
          <div className="flex flex-wrap gap-2">
            <Chip href={comFiltros(params, { tipologia: undefined })} ativo={!params.tipologia}>
              Todas
            </Chip>
            {tipologias.map((t) => (
              <Chip
                key={t.valor}
                href={comFiltros(params, { tipologia: t.valor })}
                ativo={params.tipologia === t.valor}
              >
                {t.rotulo}
                <span className="ml-1.5 text-xs opacity-70 tabular-nums">{formatarInteiro(t.transacoes)}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkPredioInteiro({ dados }: { dados: RadarBusca }) {
  return (
    <LinkBusca
      href={novaBusca({ cl: String(dados.cl), numero: String(dados.numero), q: dados.titulo ?? undefined })}
      className="inline-flex items-center gap-1 text-sm font-semibold text-[#585a4f] hover:underline"
    >
      Ver todas as vendas do prédio ({formatarInteiro(dados.total_predio)})
      <ChevronRight className="w-4 h-4" aria-hidden />
    </LinkBusca>
  );
}

function UnidadeSemVenda({ dados }: { dados: RadarBusca }) {
  return (
    <div className={cn(CARTAO, "p-6 text-center")}>
      <p className="text-[#2d2f28] font-semibold">
        Nenhuma venda registrada para a unidade {dados.unidade} desde 2011.
      </p>
      <p className="text-sm text-[#7a7c72] mt-1">
        Confira o bloco e o número da unidade, ou veja as outras vendas do prédio.
      </p>
      <div className="mt-4">
        <LinkPredioInteiro dados={dados} />
      </div>
    </div>
  );
}

function SemVendasNoPeriodo({ dados, params }: Props) {
  const temHistorico = dados.total_historico > 0;
  return (
    <div className={cn(CARTAO, "p-6 text-center")}>
      <p className="text-[#2d2f28] font-semibold">Nenhuma venda registrada neste período.</p>
      {temHistorico && !params.todo_periodo && (
        <>
          <p className="text-sm text-[#7a7c72] mt-1">
            Há {plural(dados.total_historico, "venda registrada", "vendas registradas")} desde 2011.
          </p>
          <LinkBusca
            href={comFiltros(params, { desde: undefined, ate: undefined, tipologia: undefined, todo_periodo: "true" })}
            className="inline-flex mt-4 rounded-lg bg-[#585a4f] hover:bg-[#4a4d43] text-white text-sm font-semibold px-4 py-2.5"
          >
            Ver desde 2011
          </LinkBusca>
        </>
      )}
    </div>
  );
}

function Paginacao({ dados, params }: Props) {
  const paginas = Math.ceil(dados.total / dados.por_pagina);
  if (paginas <= 1) return null;
  const pagina = dados.pagina;
  const link = "inline-flex items-center gap-1.5 rounded-lg border border-[#e4e1d6] bg-white px-3.5 py-2 text-sm font-medium text-[#2d2f28] hover:border-[#585a4f]";
  return (
    <nav className="flex items-center justify-between gap-3 pt-1" aria-label="Paginação">
      {pagina > 1 ? (
        <LinkBusca href={urlMoraMetrica({ ...params, pagina: String(pagina - 1) })} className={link}>
          <ArrowLeft className="w-4 h-4" aria-hidden /> Anterior
        </LinkBusca>
      ) : (
        <span />
      )}
      <span className="text-sm text-[#7a7c72] tabular-nums">
        Página {pagina} de {paginas}
      </span>
      {pagina < paginas ? (
        <LinkBusca href={urlMoraMetrica({ ...params, pagina: String(pagina + 1) })} className={link}>
          Próxima <ArrowRight className="w-4 h-4" aria-hidden />
        </LinkBusca>
      ) : (
        <span />
      )}
    </nav>
  );
}

const TH = "px-4 py-3 font-semibold text-xs uppercase tracking-wider text-[#7a7c72]";
const TD = "px-4 py-3.5 tabular-nums";
// O cabeçalho é em caixa alta; "m²" precisa ficar minúsculo.
const M2 = <span className="normal-case">R$/m²</span>;

// ── Prédio ───────────────────────────────────────────────────────────────────

function valorM2(t: Transacao): string {
  return t.parcial ? "Fração" : formatarM2(t.valor_m2);
}

function ListaTransacoes({ dados, params }: Props) {
  const temFracao = dados.transacoes.some((t) => t.parcial);
  return (
    <div className="space-y-4">
      <h3 className="font-serif text-xl text-[#2d2f28]">Vendas registradas</h3>

      {/* Celular: cartões empilhados */}
      <ul className="md:hidden space-y-3">
        {dados.transacoes.map((t, i) => (
          <li key={i} className={cn(CARTAO, "p-4")}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-[#2d2f28]">{formatarMes(t.competencia)}</span>
              <span className="text-base font-semibold text-[#2d2f28] tabular-nums">
                {formatarValor(t.valor_declarado)}
              </span>
            </div>
            <p className="text-sm text-[#7a7c72] mt-1">
              {[t.tipologia, t.complemento].filter(Boolean).join(" · ")}
            </p>
            <div className="flex items-baseline justify-between gap-3 mt-2 text-sm text-[#2d2f28] tabular-nums">
              <span>{formatarArea(t.area)}</span>
              <span>{valorM2(t)}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Computador: tabela */}
      <div className={cn(CARTAO, "hidden md:block overflow-hidden")}>
        <table className="w-full text-sm text-[#2d2f28]">
          <thead className="bg-[#f7f6f2] text-left">
            <tr>
              <th scope="col" className={TH}>Mês</th>
              <th scope="col" className={TH}>Tipologia</th>
              <th scope="col" className={TH}>Unidade</th>
              <th scope="col" className={cn(TH, "text-right")}>Área</th>
              <th scope="col" className={cn(TH, "text-right")}>Valor declarado</th>
              <th scope="col" className={cn(TH, "text-right")}>{M2}</th>
            </tr>
          </thead>
          <tbody>
            {dados.transacoes.map((t, i) => (
              <tr key={i} className="border-t border-[#efede5]">
                <td className={TD}>{formatarMes(t.competencia)}</td>
                <td className="px-4 py-3.5">{t.tipologia}</td>
                <td className="px-4 py-3.5 text-[#7a7c72]">{t.complemento ?? "Sem dado"}</td>
                <td className={cn(TD, "text-right")}>{formatarArea(t.area)}</td>
                <td className={cn(TD, "text-right font-semibold")}>{formatarValor(t.valor_declarado)}</td>
                <td className={cn(TD, "text-right")}>{valorM2(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {temFracao && (
        <p className="text-xs text-[#7a7c72]">
          Fração: venda de parte do imóvel ou de fração de terreno em lançamento. O valor por m² não
          se aplica e essas vendas ficam fora da média do m².
        </p>
      )}
      <Paginacao dados={dados} params={params} />
      {dados.unidade && <LinkPredioInteiro dados={dados} />}
    </div>
  );
}

// ── Rua ──────────────────────────────────────────────────────────────────────

function ListaPredios({ dados, params }: Props) {
  const rua = dados.titulo ?? "";
  const linkPredio = (numero: number) =>
    novaBusca({ cl: String(dados.cl), numero: String(numero), q: `${rua}, ${numero}` });
  const porVendas = params.ordem === "transacoes";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-xl text-[#2d2f28]">
          {plural(dados.total, "prédio com venda", "prédios com venda")}
        </h3>
        <div className="flex gap-2" aria-label="Ordenar prédios">
          <Chip href={comFiltros(params, { ordem: undefined })} ativo={!porVendas}>
            Por número
          </Chip>
          <Chip href={comFiltros(params, { ordem: "transacoes" })} ativo={porVendas}>
            Mais vendas
          </Chip>
        </div>
      </div>

      <ul className="md:hidden space-y-3">
        {dados.predios.map((p) => (
          <li key={p.numero}>
            <LinkBusca href={linkPredio(p.numero)} className={cn(CARTAO, "flex items-center gap-4 p-4")}>
              <span className="font-serif text-2xl text-[#3e4037] w-16 shrink-0 tabular-nums">{p.numero}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#2d2f28] tabular-nums">
                  {formatarM2(p.media_m2)}
                </span>
                <span className="block text-xs text-[#7a7c72] mt-0.5">
                  {plural(p.transacoes, "venda", "vendas")} · última em {formatarMes(p.ultima)}
                </span>
                <span className="block text-xs text-[#7a7c72]">{p.tipologia}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-[#b0b2a8] shrink-0" aria-hidden />
            </LinkBusca>
          </li>
        ))}
      </ul>

      <div className={cn(CARTAO, "hidden md:block overflow-hidden")}>
        <table className="w-full text-sm text-[#2d2f28]">
          <thead className="bg-[#f7f6f2] text-left">
            <tr>
              <th scope="col" className={TH}>Número</th>
              <th scope="col" className={cn(TH, "text-right")}>Vendas</th>
              <th scope="col" className={cn(TH, "text-right")}>Média {M2}</th>
              <th scope="col" className={TH}>Última venda</th>
              <th scope="col" className={TH}>Tipologia mais comum</th>
              <th scope="col" className={TH}><span className="sr-only">Abrir</span></th>
            </tr>
          </thead>
          <tbody>
            {dados.predios.map((p) => (
              <tr key={p.numero} className="border-t border-[#efede5] hover:bg-[#fbfaf7]">
                <td className={cn(TD, "font-semibold")}>
                  <LinkBusca href={linkPredio(p.numero)} className="hover:underline">
                    {rua}, {p.numero}
                  </LinkBusca>
                </td>
                <td className={cn(TD, "text-right")}>{formatarInteiro(p.transacoes)}</td>
                <td className={cn(TD, "text-right")}>{formatarM2(p.media_m2)}</td>
                <td className={TD}>{formatarMes(p.ultima)}</td>
                <td className="px-4 py-3.5">{p.tipologia}</td>
                <td className="px-4 py-3.5 text-right">
                  <LinkBusca
                    href={linkPredio(p.numero)}
                    className="inline-flex items-center gap-1 text-[#585a4f] font-semibold hover:underline whitespace-nowrap"
                  >
                    Ver vendas <ChevronRight className="w-4 h-4" aria-hidden />
                  </LinkBusca>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.sem_numero > 0 && (
        <p className="text-xs text-[#7a7c72]">
          Mais {plural(dados.sem_numero, "venda", "vendas")} sem número na base da Prefeitura entram
          só no resumo.
        </p>
      )}
      <Paginacao dados={dados} params={params} />
    </div>
  );
}

// ── Bairro ───────────────────────────────────────────────────────────────────

const TIPOLOGIAS_VISIVEIS = 8;

function ResumoBairro({ dados, params }: Props) {
  // Bairros chegam a ter 15 tipologias, várias com 1 ou 2 vendas no período
  const [todas, setTodas] = useState(false);
  const ocultas = dados.por_tipologia.length - TIPOLOGIAS_VISIVEIS;
  const tipologias = todas ? dados.por_tipologia : dados.por_tipologia.slice(0, TIPOLOGIAS_VISIVEIS);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] items-start">
      <div className="space-y-3 min-w-0">
        <div>
          <h3 className="font-serif text-xl text-[#2d2f28]">Por tipologia</h3>
          <p className="text-xs text-[#7a7c72] mt-0.5">Médias do período, de cada tipologia.</p>
        </div>
        <ul className="md:hidden space-y-3">
          {tipologias.map((t) => (
            <li key={t.valor}>
              <LinkBusca
                href={comFiltros(params, { tipologia: t.valor })}
                className={cn(CARTAO, "block p-4")}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-[#2d2f28]">{t.rotulo}</span>
                  <span className="text-sm text-[#7a7c72] tabular-nums">
                    {plural(t.transacoes, "venda", "vendas")}
                  </span>
                </span>
                <span className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#7a7c72]">
                  <span>Por m²<br /><b className="text-sm text-[#2d2f28] tabular-nums">{formatarM2(t.media_m2)}</b></span>
                  <span>Valor<br /><b className="text-sm text-[#2d2f28] tabular-nums">{formatarValor(t.media_valor)}</b></span>
                  <span>Área<br /><b className="text-sm text-[#2d2f28] tabular-nums">{formatarArea(t.media_area)}</b></span>
                </span>
              </LinkBusca>
            </li>
          ))}
        </ul>
        <div className={cn(CARTAO, "hidden md:block overflow-hidden")}>
          <table className="w-full text-sm text-[#2d2f28]">
            <thead className="bg-[#f7f6f2] text-left">
              <tr>
                <th scope="col" className={TH}>Tipologia</th>
                <th scope="col" className={cn(TH, "text-right")}>Vendas</th>
                <th scope="col" className={cn(TH, "text-right")}>{M2}</th>
                <th scope="col" className={cn(TH, "text-right")}>Valor</th>
                <th scope="col" className={cn(TH, "text-right")}>Área</th>
              </tr>
            </thead>
            <tbody>
              {tipologias.map((t) => (
                <tr key={t.valor} className="border-t border-[#efede5] hover:bg-[#fbfaf7]">
                  <td className="px-4 py-3.5">
                    <LinkBusca href={comFiltros(params, { tipologia: t.valor })} className="font-semibold hover:underline">
                      {t.rotulo}
                    </LinkBusca>
                  </td>
                  <td className={cn(TD, "text-right")}>{formatarInteiro(t.transacoes)}</td>
                  <td className={cn(TD, "text-right")}>{formatarM2(t.media_m2)}</td>
                  <td className={cn(TD, "text-right")}>{formatarValor(t.media_valor)}</td>
                  <td className={cn(TD, "text-right")}>{formatarArea(t.media_area)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ocultas > 0 && (
          <button
            type="button"
            onClick={() => setTodas((v) => !v)}
            aria-expanded={todas}
            className="text-sm font-semibold text-[#585a4f] hover:underline"
          >
            {todas ? "Mostrar só as principais" : `Mostrar mais ${plural(ocultas, "tipologia", "tipologias")}`}
          </button>
        )}
      </div>

      <div className="space-y-3 min-w-0">
        <h3 className="font-serif text-xl text-[#2d2f28]">Ruas mais negociadas</h3>
        <ol className={cn(CARTAO, "divide-y divide-[#efede5] overflow-hidden")}>
          {dados.ruas.map((r, i) => (
            <li key={r.cl}>
              <LinkBusca
                href={novaBusca({ cl: String(r.cl), q: r.nome })}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#fbfaf7]"
              >
                <span className="w-5 text-xs font-semibold text-[#9a8d3a] tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#2d2f28] truncate">{r.nome}</span>
                  <span className="block text-xs text-[#7a7c72] tabular-nums">
                    {plural(r.transacoes, "venda", "vendas")} · {formatarM2(r.media_m2)}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#b0b2a8] shrink-0" aria-hidden />
              </LinkBusca>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Escolha entre homônimos e sem resultado ──────────────────────────────────

function Opcoes({ dados }: { dados: RadarBusca }) {
  const numero = dados.numero;
  return (
    <div className={cn(CARTAO, "p-5 sm:p-7")}>
      <h2 className="font-serif text-2xl text-[#2d2f28]">Qual destes logradouros?</h2>
      <p className="text-sm text-[#7a7c72] mt-1">
        Há mais de um logradouro com esse nome na cidade.
        {numero ? ` Todos abaixo têm venda registrada no número ${numero}.` : ""}
      </p>
      <ul className="mt-4 divide-y divide-[#efede5]">
        {dados.opcoes.map((o) => (
          <li key={o.cl}>
            <LinkBusca
              href={novaBusca({
                cl: String(o.cl),
                numero: numero ? String(numero) : undefined,
                unidade: dados.unidade ?? undefined,
                q: [o.nome, numero, dados.unidade].filter(Boolean).join(", "),
              })}
              className="flex items-center gap-3 py-3.5 group"
            >
              <MapPin className="w-4 h-4 text-[#9a8d3a] shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[#2d2f28] group-hover:underline">{o.nome}</span>
                <span className="block text-xs text-[#7a7c72]">
                  {[o.bairros.join(", "), plural(o.transacoes, "venda", "vendas")].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-[#b0b2a8] shrink-0" aria-hidden />
            </LinkBusca>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Nenhum({ dados }: { dados: RadarBusca }) {
  // A rua existe, mas o número não tem venda registrada
  if (dados.cl && dados.numero && dados.titulo) {
    const rua = dados.titulo.replace(/,\s*\d+$/, "");
    return (
      <div className={cn(CARTAO, "p-5 sm:p-7")}>
        <SearchX className="w-6 h-6 text-[#9a8d3a]" aria-hidden />
        <h2 className="font-serif text-2xl text-[#2d2f28] mt-3">
          Nenhuma venda registrada em {dados.titulo}
        </h2>
        <p className="text-sm text-[#7a7c72] mt-1">
          A base da Prefeitura não tem transação nesse número desde 2011.
          {dados.numeros_proximos.length > 0 && " Números próximos com vendas:"}
        </p>
        {dados.numeros_proximos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {dados.numeros_proximos.map((n) => (
              <Chip key={n} href={novaBusca({ cl: String(dados.cl), numero: String(n), q: `${rua}, ${n}` })} ativo={false}>
                {rua}, {n}
              </Chip>
            ))}
          </div>
        )}
        <LinkBusca
          href={novaBusca({ cl: String(dados.cl), q: rua })}
          className="inline-flex items-center gap-1 mt-5 text-sm font-semibold text-[#585a4f] hover:underline"
        >
          Ver todos os prédios deste logradouro <ChevronRight className="w-4 h-4" aria-hidden />
        </LinkBusca>
      </div>
    );
  }

  return (
    <div className={cn(CARTAO, "p-5 sm:p-7")}>
      <SearchX className="w-6 h-6 text-[#9a8d3a]" aria-hidden />
      <h2 className="font-serif text-2xl text-[#2d2f28] mt-3">
        Não encontramos vendas para &ldquo;{dados.consulta}&rdquo;
      </h2>
      <p className="text-sm text-[#7a7c72] mt-1">
        Confira a grafia ou tente só o nome da rua e o número, como &ldquo;Vieira Souto 510&rdquo;.
      </p>
      {dados.sugestoes.length > 0 && (
        <>
          <p className="text-sm font-semibold text-[#2d2f28] mt-5">Você quis dizer:</p>
          <ul className="mt-2 divide-y divide-[#efede5]">
            {dados.sugestoes.map((s) => {
              const href = urlSugestao(s);
              return (
                <li key={`${s.tipo}-${s.cl ?? s.bairro}`}>
                  <LinkBusca href={href} className="flex items-center gap-3 py-3 group">
                    {s.tipo === "bairro" ? (
                      <MapaIcon className="w-4 h-4 text-[#9a8d3a] shrink-0" aria-hidden />
                    ) : (
                      <MapPin className="w-4 h-4 text-[#9a8d3a] shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[#2d2f28] group-hover:underline">{s.consulta}</span>
                      {s.detalhe && <span className="block text-xs text-[#7a7c72]">{s.detalhe}</span>}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#b0b2a8] shrink-0" aria-hidden />
                  </LinkBusca>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
