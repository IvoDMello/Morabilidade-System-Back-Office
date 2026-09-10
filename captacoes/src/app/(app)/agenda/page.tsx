"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Home, Plus, Trash2, Video } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { VazioAgenda } from "@/components/app/Vazios";
import { AgendarDialog } from "@/components/agenda/AgendarDialog";
import { useApp } from "@/stores/app";
import { usePauta } from "@/stores/pauta";
import { carregarPauta } from "@/lib/pauta-api";
import { usePautaAcoes } from "@/lib/usePautaAcoes";
import { progresso, rotuloData } from "@/lib/pauta";
import { PautaDialog, type PautaDados } from "@/components/pauta/PautaDialog";
import { AdicionarItem } from "@/components/pauta/AdicionarItem";
import { contadores, hojeLocal } from "@/lib/contadores";
import { PENDENCIA_LABEL, etapaDaCaptacao, pendenciaDaCaptacao } from "@/lib/etapa";
import { agruparPorDia, proximosCompromissos, rotuloDoDia, type TipoCompromisso } from "@/lib/agendamento";
import { gravacoesNoPeriodo, mesDe, resumoGravacoes } from "@/lib/gravacoes";
import { cn, CONTAINER } from "@/lib/utils";
import type { Captacao } from "@/types";

export default function AgendaPage() {
  const { cards, userId } = useApp();
  const { pautas, setTudo, itensDe } = usePauta();
  const acoes = usePautaAcoes();
  const [agendando, setAgendando] = useState<{ captacao: Captacao; tipo: TipoCompromisso } | null>(null);
  const [pautaAberta, setPautaAberta] = useState(false);

  const hoje = hojeLocal();
  const nums = useMemo(() => contadores(cards, hoje, userId), [cards, hoje, userId]);

  // A pauta tem store própria (é compartilhada com o detalhe da captação).
  useEffect(() => {
    carregarPauta().then(({ pautas, itens }) => setTudo(pautas, itens));
  }, [setTudo]);

  const aprovadas = useMemo(() => cards.filter((c) => etapaDaCaptacao(c) === "aprovada"), [cards]);

  const pendencias = useMemo(() => {
    const visita: Captacao[] = [];
    const gravacao: Captacao[] = [];
    for (const c of aprovadas) {
      const p = pendenciaDaCaptacao(c);
      if (p === "agendar_visita") visita.push(c);
      else if (p === "agendar_gravacao") gravacao.push(c);
    }
    return { visita, gravacao };
  }, [aprovadas]);

  const dias = useMemo(() => agruparPorDia(proximosCompromissos(cards, hoje)), [cards, hoje]);
  const mes = useMemo(() => mesDe(hoje), [hoje]);
  const resumo = useMemo(() => resumoGravacoes(gravacoesNoPeriodo(cards, mes)), [cards, mes]);

  const semNada = dias.length === 0 && pendencias.visita.length === 0 && pendencias.gravacao.length === 0;

  return (
    <>
      <AppHeader
        titulo="Agenda"
        contadores={nums}
        busca={false}
        subtitulo={`${nums.agenda} a agendar · ${dias.reduce((n, d) => n + d.itens.length, 0)} compromissos à frente`}
      />

      <div className={cn(CONTAINER, "no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-[18px] pb-6 pt-[18px] [&>*]:shrink-0 lg:px-6 lg:pb-8")}>
        {semNada ? (
          <VazioAgenda pendentes={0} />
        ) : (
          <>
            {(pendencias.visita.length > 0 || pendencias.gravacao.length > 0) && (
              <Secao titulo="Pendências">
                <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
                  <GrupoPendencia
                    tipo="visita"
                    itens={pendencias.visita}
                    onAgendar={(c) => setAgendando({ captacao: c, tipo: "visita" })}
                  />
                  <GrupoPendencia
                    tipo="gravacao"
                    itens={pendencias.gravacao}
                    onAgendar={(c) => setAgendando({ captacao: c, tipo: "gravacao" })}
                  />
                </div>
              </Secao>
            )}

            {dias.length > 0 && (
              <Secao
                titulo="Próximos compromissos"
                acessorio={
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    na Google Agenda
                  </span>
                }
              >
                {dias.map((d) => (
                  <div key={d.dia} className="mb-4 last:mb-0">
                    <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-secondary">
                      {rotuloDoDia(d.dia, hoje)}
                    </p>
                    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5 xl:grid-cols-3">
                      {d.itens.map((k) => (
                        <button
                          key={`${k.captacao.id}-${k.tipo}`}
                          type="button"
                          onClick={() => setAgendando({ captacao: k.captacao, tipo: k.tipo })}
                          className="flex gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(46,48,42,0.04)]"
                          style={{ borderLeft: `3px solid ${k.tipo === "visita" ? "#5a9a6e" : "#5887a0"}` }}
                        >
                          <span className="w-[52px] flex-none">
                            <span className="block text-[15px] font-bold tracking-[-0.01em] text-foreground">
                              {k.temHora
                                ? new Date(k.quando).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </span>
                            <span className="mt-px block text-[11px] text-muted-foreground">
                              {k.temHora ? `${k.duracaoMin} min` : "sem hora"}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 border-l pl-3">
                            <span className="block text-sm font-semibold leading-snug text-foreground">
                              {k.captacao.endereco}
                            </span>
                            {k.captacao.bairro && (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {k.captacao.bairro}
                              </span>
                            )}
                            <span
                              className="mt-1.5 inline-flex h-[21px] items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold"
                              style={
                                k.tipo === "visita"
                                  ? { background: "#e5efe8", color: "#2f6b46" }
                                  : { background: "#e3edf1", color: "#2f5b6f" }
                              }
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: k.tipo === "visita" ? "#5a9a6e" : "#5887a0" }}
                              />
                              {k.tipo === "visita" ? "Visita" : "Gravação"}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </Secao>
            )}
          </>
        )}

        <Secao
          titulo="Pauta de gravação"
          acessorio={
            <button
              type="button"
              onClick={() => setPautaAberta(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#9a8d3a]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              Nova pauta
            </button>
          }
        >
          {pautas.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-muted/30 p-4 text-center text-[13px] text-muted-foreground">
              Nenhuma pauta montada. Uma pauta é a sessão de gravação de um dia.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
              {pautas.map((p) => {
                const dela = itensDe(p.id);
                const { feitos, total } = progresso(dela);
                return (
                  <div key={p.id} className="rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(46,48,42,0.04)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-[17px] font-semibold text-foreground">{p.titulo}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {p.data_alvo ? rotuloData(p.data_alvo) : "sem dia definido"} · {total}{" "}
                          {total === 1 ? "item" : "itens"}
                        </p>
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        <span className="inline-flex h-[23px] items-center rounded-md bg-primary/25 px-2.5 text-[11.5px] font-semibold text-[#857727]">
                          {feitos} de {total}
                        </span>
                        <button
                          type="button"
                          onClick={() => acoes.excluir(p)}
                          aria-label={`Excluir pauta ${p.titulo}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {dela.length > 0 && (
                      <div className="mt-3 divide-y overflow-hidden rounded-xl border">
                        {dela.map((i) => (
                          <label
                            key={i.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 px-3 py-2.5",
                              i.concluido ? "bg-muted/50" : "bg-card"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={i.concluido}
                              onChange={() => acoes.alterarItem(i, { concluido: !i.concluido })}
                              className="h-[18px] w-[18px] rounded accent-secondary"
                            />
                            <span
                              className={cn(
                                "text-[13px]",
                                i.concluido
                                  ? "text-muted-foreground line-through"
                                  : "font-medium text-foreground"
                              )}
                            >
                              {i.texto}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="mt-3">
                      <AdicionarItem
                        onAdicionar={(texto, captacaoId) => acoes.adicionarItem(p.id, texto, captacaoId)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Secao>

        <Secao titulo="Gravadas">
          <Link
            href="/agenda/gravadas"
            className="flex items-center gap-3.5 rounded-2xl p-4 text-left shadow-[0_12px_28px_-14px_rgba(46,48,42,0.55)]"
            style={{ background: "linear-gradient(150deg,#3d3f36,#585a4f)" }}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-[29px] font-semibold leading-none text-[#f3f4f0]">
                {resumo.total}
              </span>
              <span className="mt-1.5 block text-[12.5px] text-white/75">
                {resumo.total === 1 ? "gravação" : "gravações"} neste mês
                {resumo.total > 0 && ` · ${resumo.noSistema} já no sistema`}
              </span>
            </span>
            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-xl bg-primary/25">
              <ChevronRight className="h-[17px] w-[17px] text-primary" />
            </span>
          </Link>
        </Secao>
      </div>

      <PautaDialog
        open={pautaAberta}
        onOpenChange={setPautaAberta}
        onSalvar={(dados: PautaDados) => acoes.criar(dados)}
      />

      {agendando && (
        <AgendarDialog
          captacao={agendando.captacao}
          tipo={agendando.tipo}
          open
          onOpenChange={(v) => !v && setAgendando(null)}
        />
      )}
    </>
  );
}

function Secao({
  titulo,
  acessorio,
  children,
}: {
  titulo: string;
  acessorio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {titulo}
        </h2>
        {acessorio}
      </div>
      {children}
    </section>
  );
}

function GrupoPendencia({
  tipo,
  itens,
  onAgendar,
}: {
  tipo: TipoCompromisso;
  itens: Captacao[];
  onAgendar: (c: Captacao) => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (itens.length === 0) return null;

  const Icone = tipo === "visita" ? Home : Video;
  const tom = tipo === "visita" ? { bg: "#e5efe8", fg: "#2f6b46" } : { bg: "#e3edf1", fg: "#2f5b6f" };
  const label = PENDENCIA_LABEL[tipo === "visita" ? "agendar_visita" : "agendar_gravacao"];

  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3.5 rounded-[15px] border bg-card p-3.5 text-left shadow-[0_1px_2px_rgba(46,48,42,0.04)]"
      >
        <span
          className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl"
          style={{ background: tom.bg }}
        >
          <Icone className="h-[19px] w-[19px]" style={{ color: tom.fg }} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-foreground">{label}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {itens
              .slice(0, 2)
              .map((c) => c.endereco)
              .join(", ")}
            {itens.length > 2 && ` e mais ${itens.length - 2}`}
          </span>
        </span>
        <span className="flex flex-none items-center gap-2">
          <span
            className="flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-[12.5px] font-bold"
            style={{ background: tom.bg, color: tom.fg }}
          >
            {itens.length}
          </span>
          <ChevronRight
            className={cn("h-4 w-4 text-muted-foreground transition-transform", aberto && "rotate-90")}
          />
        </span>
      </button>

      {aberto && (
        <div className="mt-2 flex flex-col gap-1.5 pl-3">
          {itens.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onAgendar(c)}
              className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-foreground">
                  {c.endereco}
                </span>
                {c.bairro && <span className="block text-xs text-muted-foreground">{c.bairro}</span>}
              </span>
              <span className="flex-none text-xs font-semibold" style={{ color: tom.fg }}>
                Agendar
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
