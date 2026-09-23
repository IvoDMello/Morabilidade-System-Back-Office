"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Search, SearchX } from "lucide-react";
import { useApp } from "@/stores/app";
import { buscaGlobal, totalResultados } from "@/lib/busca";
import { formatBRL, resumoSpecs } from "@/lib/format";
import { STATUS_STYLE } from "@/lib/status-style";
import { cn } from "@/lib/utils";
import type { Captacao, Etapa } from "@/types";

/**
 * Resultado da busca fora da aba aberta.
 *
 * A caixa de busca do cabeçalho é uma só, mas cada aba filtrava apenas a
 * própria etapa: procurar um endereço em Decidir não achava nada se ele já
 * tivesse sido aprovado — e quem procura, em geral, procura justamente porque
 * não lembra em que ponto do fluxo a captação está. Este painel completa a
 * consulta: a aba continua mandando no que aparece em cima, e o que casou no
 * resto do app vem aqui embaixo, agrupado pela aba de origem.
 *
 * Fica recolhível, mas abre sozinho: quem digitou quer ver o resultado, não
 * clicar de novo para vê-lo.
 */
export function ResultadosGlobais({
  excluir,
  className,
}: {
  /** Etapa que a tela já está listando — não repetir os mesmos cartões. */
  excluir?: Etapa;
  className?: string;
}) {
  const cards = useApp((s) => s.cards);
  const filtro = useApp((s) => s.filtro);
  const [aberto, setAberto] = useState(true);

  const grupos = useMemo(() => buscaGlobal(cards, filtro, excluir), [cards, filtro, excluir]);
  const total = totalResultados(grupos);

  if (!filtro.trim()) return null;

  const termo = filtro.trim();

  if (total === 0) {
    return (
      <section className={cn("rounded-2xl border border-dashed bg-muted/30 px-3.5 py-4", className)}>
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <SearchX className="h-4 w-4 flex-none" />
          {excluir
            ? `Nada com «${termo}» nas outras abas.`
            : `Nada com «${termo}» em nenhuma aba.`}
        </p>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl border bg-card", className)}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left"
      >
        <Search className="h-4 w-4 flex-none text-[#9a8d3a]" strokeWidth={2.2} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-foreground">
            {excluir ? "Em outras abas" : "Resultados da busca"}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
            {total} {total === 1 ? "captação" : "captações"} com «{termo}»
            {" · "}
            {grupos.map((g) => `${g.titulo} ${g.itens.length}`).join(" · ")}
          </span>
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 flex-none text-muted-foreground transition-transform",
            aberto && "rotate-90"
          )}
        />
      </button>

      {aberto && (
        <div className="flex flex-col gap-4 border-t px-3.5 py-3.5">
          {grupos.map((g) => (
            <div key={g.etapa}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {g.titulo}
                </span>
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted px-1.5 text-[10.5px] font-semibold text-muted-foreground">
                  {g.itens.length}
                </span>
                {/* Atalho para a aba de origem: achou aqui, continua lá com os
                    botões daquela etapa (aprovar, agendar, dar retorno). */}
                {g.href && (
                  <Link
                    href={g.href}
                    className="ml-auto flex flex-none items-center gap-0.5 text-[11.5px] font-semibold text-secondary"
                  >
                    Abrir aba
                    <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} />
                  </Link>
                )}
              </div>
              <div className="flex flex-col gap-1.5 lg:grid lg:grid-cols-2 lg:gap-2">
                {g.itens.map((c) => (
                  <LinhaResultado key={c.id} captacao={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Linha enxuta do resultado: endereço, bairro, specs, valor e o selo do
 * status. Sem capa e sem ações de propósito — aqui a pergunta é "existe e
 * onde está?"; o que fazer com a captação se decide no detalhe ou na aba dela.
 */
function LinhaResultado({ captacao }: { captacao: Captacao }) {
  const estilo = STATUS_STYLE[captacao.status];

  return (
    <Link
      href={`/captacao/${captacao.id}`}
      className="flex items-start gap-2.5 rounded-xl border bg-background px-3 py-2.5 hover:bg-muted/50"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-foreground">
          {captacao.endereco}
          {captacao.apto && <span className="text-muted-foreground"> / {captacao.apto}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {[captacao.bairro, resumoSpecs(captacao)].filter(Boolean).join(" · ")}
        </span>
        {captacao.valor_venda != null && (
          <span className="mt-1 block text-[12.5px] font-bold text-foreground">
            {formatBRL(captacao.valor_venda)}
          </span>
        )}
      </span>
      <span
        className="inline-flex h-[22px] flex-none items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold"
        style={{ background: estilo.bg, color: estilo.fg }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: estilo.dot }} />
        {estilo.short}
      </span>
    </Link>
  );
}
