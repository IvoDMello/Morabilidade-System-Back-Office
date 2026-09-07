"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingDown, TrendingUp } from "lucide-react";
import { VazioGravacoes } from "@/components/app/Vazios";
import { useApp } from "@/stores/app";
import { hojeLocal } from "@/lib/contadores";
import { corDaLista, indexarListas } from "@/lib/listas";
import {
  agruparPorMes,
  diaDaGravacao,
  gravacoesNoPeriodo,
  mesAnterior,
  mesDe,
  resumoGravacoes,
  type Periodo,
} from "@/lib/gravacoes";
import { cn } from "@/lib/utils";

type Atalho = "mes" | "anterior" | "90d";

const ATALHO_LABEL: Record<Atalho, string> = {
  mes: "Este mês",
  anterior: "Mês passado",
  "90d": "Últimos 90 dias",
};

function periodoDe(atalho: Atalho, hoje: string): Periodo {
  const mes = mesDe(hoje);
  if (atalho === "mes") return mes;
  if (atalho === "anterior") return mesAnterior(mes);
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 89);
  return { de: d.toISOString().slice(0, 10), ate: hoje };
}

function nomeDoMes(ym: string): string {
  return new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Contabilidade de gravações: quantas, quando, e o código do imóvel no
 * sistema. Quando falta o código, o chip vazado "não cadastrada" transforma a
 * ausência numa pendência visível.
 */
export default function GravadasPage() {
  const { cards, listas, vinculos } = useApp();
  const [atalho, setAtalho] = useState<Atalho>("mes");

  const hoje = hojeLocal();
  const periodo = useMemo(() => periodoDe(atalho, hoje), [atalho, hoje]);

  const gravadas = useMemo(() => gravacoesNoPeriodo(cards, periodo), [cards, periodo]);
  const resumo = useMemo(() => resumoGravacoes(gravadas), [gravadas]);
  const grupos = useMemo(() => agruparPorMes(gravadas), [gravadas]);
  const porCaptacao = useMemo(() => indexarListas(vinculos, listas), [vinculos, listas]);

  // Comparação só faz sentido de mês para mês.
  const anterior = useMemo(() => {
    if (atalho === "90d") return null;
    const p = mesAnterior(periodo);
    return gravacoesNoPeriodo(cards, p).length;
  }, [atalho, periodo, cards]);

  const delta = anterior === null ? null : resumo.total - anterior;
  const rotuloPeriodo = atalho === "90d" ? "últimos 90 dias" : nomeDoMes(periodo.de.slice(0, 7));

  return (
    <>
      <header className="flex flex-none items-center gap-3 border-b bg-card px-[18px] py-3.5">
        <Link
          href="/agenda"
          aria-label="Voltar para a agenda"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-muted text-secondary"
        >
          <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.2} />
        </Link>
        <h1 className="flex-1 font-serif text-[19px] font-semibold text-foreground">Gravadas</h1>
      </header>

      <div className="flex-none border-b bg-card px-[18px] pb-5 pt-1.5">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-serif text-[52px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {resumo.total}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {resumo.total === 1 ? "gravação" : "gravações"} em{" "}
              <strong className="font-semibold text-foreground">{rotuloPeriodo}</strong>
            </p>
          </div>

          {delta !== null && delta !== 0 && (
            <div className="pb-1 text-right">
              <p
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold",
                  delta > 0 ? "text-[#2f6b46]" : "text-[#9a3b3b]"
                )}
              >
                {delta > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {delta > 0 ? "+" : ""}
                {delta}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">vs. mês anterior ({anterior})</p>
            </div>
          )}
        </div>

        {resumo.total > 0 && (
          <div className="mt-4 flex gap-2.5">
            <Tile label="No sistema" valor={resumo.noSistema} />
            <Tile
              label="Sem cadastro"
              valor={resumo.semCadastro}
              destaque={resumo.semCadastro > 0}
            />
            <Tile label="Publicadas" valor={resumo.publicadas} />
          </div>
        )}

        <div className="no-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto">
          {(Object.keys(ATALHO_LABEL) as Atalho[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAtalho(a)}
              aria-pressed={atalho === a}
              className={cn(
                "h-[33px] flex-none rounded-[11px] border px-3.5 text-[12.5px] font-semibold",
                atalho === a
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : "border-input bg-card text-foreground"
              )}
            >
              {ATALHO_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-[18px] py-[18px]">
        {gravadas.length === 0 ? (
          <VazioGravacoes periodo={rotuloPeriodo} />
        ) : (
          grupos.map((g) => (
            <section key={g.mes} className="mb-6 last:mb-0">
              <div className="mb-3 flex items-center gap-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  {nomeDoMes(g.mes)}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-semibold text-muted-foreground/70">
                  {g.itens.length}
                </span>
              </div>

              <div className="divide-y overflow-hidden rounded-2xl border">
                {g.itens.map((c) => {
                  const dia = diaDaGravacao(c)!;
                  const d = new Date(`${dia}T12:00:00Z`);
                  return (
                    <Link
                      key={c.id}
                      href={`/captacao/${c.id}`}
                      className="flex items-center gap-3.5 bg-card px-3.5 py-3.5"
                    >
                      <span className="w-11 flex-none text-center">
                        <span className="block font-serif text-[19px] font-semibold leading-none text-foreground">
                          {dia.slice(8, 10)}
                        </span>
                        <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                          {d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")}
                        </span>
                      </span>

                      <span className="min-w-0 flex-1 border-l pl-3.5">
                        <span className="block text-sm font-semibold leading-snug text-foreground">
                          {c.endereco}
                        </span>
                        {c.bairro && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{c.bairro}</span>
                        )}

                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {c.imovel_codigo ? (
                            <span className="inline-flex h-[21px] items-center rounded-md border border-[#ece9cf] bg-[#faf9ef] px-2 font-mono text-[11px] font-semibold text-[#9a8d3a]">
                              {c.imovel_codigo}
                            </span>
                          ) : (
                            <span className="inline-flex h-[21px] items-center rounded-md border border-dashed border-[#d3b0b0] px-2 text-[11px] font-semibold text-[#9a3b3b]">
                              não cadastrada
                            </span>
                          )}

                          {c.publicada_em && (
                            <span className="inline-flex h-[21px] items-center rounded-md bg-[#e5efe8] px-2 text-[11px] font-semibold text-[#2f6b46]">
                              publicada
                            </span>
                          )}

                          {(porCaptacao.get(c.id) ?? []).map((l) => {
                            const cor = corDaLista(l);
                            return (
                              <span
                                key={l.id}
                                className="inline-flex h-[21px] items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold"
                                style={{ background: cor.bg, color: cor.fg }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: cor.dot }}
                                />
                                {l.nome}
                              </span>
                            );
                          })}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}

function Tile({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div
      className={cn(
        "flex-1 rounded-[13px] border px-3.5 py-3",
        destaque ? "border-[#f0dcdc] bg-[#f7ecec]" : "border-border bg-muted/60"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          destaque ? "text-[#a37878]" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          destaque ? "text-[#8a4444]" : "text-foreground"
        )}
      >
        {valor}
      </p>
    </div>
  );
}
