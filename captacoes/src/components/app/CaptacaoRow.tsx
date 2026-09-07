"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronUp, GripVertical, ImageIcon, ImageOff, Link2, MapPin, MessageSquare } from "lucide-react";
import { useApp } from "@/stores/app";
import { useCapaUrl } from "@/lib/capa";
import { corDaLista } from "@/lib/listas";
import { MIDIA_VAZIA, rotuloMidia } from "@/lib/midia";
import { PENDENCIA_LABEL, foiGravada, pendenciaDaCaptacao } from "@/lib/etapa";
import { dataCurta, diasParado, formatBRL, relativo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Captacao, Lista } from "@/types";
import { MenuDaCaptacao } from "./MenuDaCaptacao";

function specs(c: Captacao): string {
  const partes: string[] = [];
  if (c.quartos != null) partes.push(`${c.quartos} ${c.quartos === 1 ? "quarto" : "quartos"}`);
  if (c.suites) partes.push(`${c.suites} ${c.suites === 1 ? "suíte" : "suítes"}`);
  if (c.banheiros != null) partes.push(`${c.banheiros} ${c.banheiros === 1 ? "banheiro" : "banheiros"}`);
  if (c.vagas) partes.push(`${c.vagas} ${c.vagas === 1 ? "vaga" : "vagas"}`);
  if (c.metragem != null) partes.push(`${c.metragem} m²`);
  return partes.join(" · ");
}

/** "aprovada em 12/08 · há 26 dias" — a data de entrada pedida no brief. */
function entrada(c: Captacao): string {
  const iso = c.decisao_em ?? c.criado_em;
  const verbo = c.decisao === "aprovada" ? "aprovada em" : c.decisao === "reprovada" ? "reprovada em" : "criada em";
  return `${verbo} ${dataCurta(iso)} · ${relativo(iso)}`;
}

const CORES_PENDENCIA = {
  agendar_visita: { bg: "#e5efe8", bd: "#c3e0cd", fg: "#2f6b46" },
  agendar_gravacao: { bg: "#e3edf1", bd: "#cbdde5", fg: "#2f5b6f" },
} as const;

/**
 * Linha da lista de aprovadas. Formato de LISTA, não de card grande: precisa
 * caber muita coisa numa tela de celular e ainda ser escaneável de relance.
 *
 * O card inteiro abre o detalhe por um link esticado por baixo (`inset-0`),
 * não por um `<Link>` envolvendo tudo: o anúncio e o menu são interativos e
 * âncora dentro de âncora é HTML inválido — o link do anúncio simplesmente
 * não abriria.
 */
export function CaptacaoRow({
  captacao,
  listas,
  posicao,
  onSubir,
  onDescer,
}: {
  captacao: Captacao;
  listas: Lista[];
  /** Presente só no modo Sequência: número da fila e setas de reordenação. */
  posicao?: number;
  onSubir?: () => void;
  onDescer?: () => void;
}) {
  const capa = useCapaUrl(captacao.capa_path);
  const opinioes = useApp((s) => s.opinioes[captacao.id]);
  const midia = useApp((s) => s.midia[captacao.id]) ?? MIDIA_VAZIA;
  const pendencia = pendenciaDaCaptacao(captacao);
  const parada = diasParado(captacao.atualizado_em);
  const emSequencia = posicao !== undefined;
  const selo = rotuloMidia(midia);

  return (
    <article className="relative flex gap-3 rounded-2xl border bg-card p-3 shadow-[0_1px_2px_rgba(46,48,42,0.04),0_10px_24px_-18px_rgba(46,48,42,0.22)]">
      {/* Link esticado: o corpo do card abre o detalhe, sem engolir os botões. */}
      <Link
        href={`/captacao/${captacao.id}`}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir ${captacao.endereco}`}
      />

      {emSequencia && (
        <div className="relative z-10 flex flex-none flex-col items-center justify-center gap-0.5 text-muted-foreground">
          <button
            type="button"
            onClick={onSubir}
            disabled={!onSubir}
            aria-label="Subir na sequência"
            className="flex h-6 w-7 items-center justify-center rounded-md disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <span className="font-serif text-[17px] font-semibold leading-none text-secondary">{posicao}</span>
          <button
            type="button"
            onClick={onDescer}
            disabled={!onDescer}
            aria-label="Descer na sequência"
            className="flex h-6 w-7 items-center justify-center rounded-md disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      )}

      {/* Capa + selo de quantas fotos existem. A capa sozinha não diz se há
          uma foto ou quinze, e é isso que decide se dá para avaliar sem abrir. */}
      <div className="relative h-16 w-16 flex-none overflow-hidden rounded-xl border bg-muted">
        {capa ? (
          <Image src={capa} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <ImageOff className="h-5 w-5 text-muted-foreground/60" />
          </span>
        )}
        {midia.fotos + midia.videos > 0 && (
          <span
            className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-md bg-black/65 px-1 py-px text-[10px] font-bold text-white"
            aria-label={selo ?? undefined}
          >
            <ImageIcon className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden />
            {midia.fotos + midia.videos}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-semibold leading-tight text-foreground [text-wrap:pretty]">
            {captacao.endereco}
            {captacao.unidade && <span className="text-muted-foreground"> / {captacao.unidade}</span>}
          </p>
          <div className="relative z-10 flex flex-none items-center gap-1.5">
            {opinioes?.naoLidas ? (
              <span className="flex items-center gap-1 rounded-md bg-primary/25 px-1.5 py-0.5 text-[10.5px] font-bold text-[#857727]">
                <MessageSquare className="h-3 w-3" />
                {opinioes.naoLidas}
              </span>
            ) : null}
            <MenuDaCaptacao captacao={captacao} />
          </div>
        </div>

        {captacao.bairro && (
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
            <MapPin className="h-3 w-3 text-[#9a8d3a]" />
            {captacao.bairro}
          </p>
        )}

        <p className="text-[12.5px] text-muted-foreground">{specs(captacao)}</p>

        {captacao.valor_venda != null && (
          <p className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
            {formatBRL(captacao.valor_venda)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Anúncio antes de qualquer coisa clicável: é o atalho que se usa
              para conferir o imóvel sem abrir o detalhe. */}
          {captacao.anuncio_url && (
            <a
              href={captacao.anuncio_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 inline-flex h-[22px] items-center gap-1.5 rounded-md border border-[#ece4b8] bg-[#faf7e8] px-2 text-[11.5px] font-semibold text-[#9a8d3a] hover:bg-[#f5efd8]"
            >
              <Link2 className="h-3 w-3" />
              Anúncio
            </a>
          )}

          {selo && (
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border bg-muted px-2 text-[11.5px] font-semibold text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              {selo}
            </span>
          )}

          {listas.map((l) => {
            const cor = corDaLista(l);
            return (
              <span
                key={l.id}
                className="inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold"
                style={{ background: cor.bg, color: cor.fg }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor.dot }} />
                {l.nome}
              </span>
            );
          })}

          {pendencia && (
            <span
              className="inline-flex h-[22px] items-center rounded-md border px-2 text-[11.5px] font-semibold"
              style={{
                background: CORES_PENDENCIA[pendencia].bg,
                borderColor: CORES_PENDENCIA[pendencia].bd,
                color: CORES_PENDENCIA[pendencia].fg,
              }}
            >
              {PENDENCIA_LABEL[pendencia]}
            </span>
          )}

          {foiGravada(captacao) && (
            <span className="inline-flex h-[22px] items-center rounded-md border bg-muted px-2 text-[11.5px] font-semibold text-muted-foreground">
              Gravada {dataCurta(captacao.gravacao_em ?? captacao.gravacao_data)}
            </span>
          )}

          {captacao.imovel_codigo && (
            <span className="inline-flex h-[22px] items-center rounded-md border border-[#ece9cf] bg-[#faf9ef] px-2 font-mono text-[11px] font-semibold text-[#9a8d3a]">
              {captacao.imovel_codigo}
            </span>
          )}
        </div>

        <p
          className={cn(
            "mt-1 border-t pt-2 text-[11.5px] text-muted-foreground",
            parada >= 3 && "text-[#a06a4a]"
          )}
        >
          {entrada(captacao)}
          {parada >= 3 && ` · parada há ${parada} dias`}
        </p>
      </div>

      {emSequencia && (
        <span className="flex flex-none items-center text-muted-foreground/50" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
      )}
    </article>
  );
}
