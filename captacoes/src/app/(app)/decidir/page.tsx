"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Home,
  ImageIcon,
  Link2,
  MessageCircle,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { FiltrosSheet } from "@/components/app/FiltrosSheet";
import { MenuDaCaptacao } from "@/components/app/MenuDaCaptacao";
import { VazioDecidir } from "@/components/app/Vazios";
import { ReprovarDialog } from "@/components/captacao/ReprovarDialog";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/stores/app";
import { createClient } from "@/lib/supabase/client";
import { confirmarDecisao, destinoDecisao, ordemFimDaColuna } from "@/lib/decisao";
import { contadores, hojeLocal } from "@/lib/contadores";
import { engavetadaSemDecisao, etapaDaCaptacao } from "@/lib/etapa";
import { filtrarCaptacoes, filtrarPorCriterios } from "@/lib/filter";
import { corDaLista, indexarListas } from "@/lib/listas";
import { MIDIA_VAZIA, rotuloMidia } from "@/lib/midia";
import { priorizarRevisaoGaveta } from "@/lib/sort";
import { useCapaUrl } from "@/lib/capa";
import {
  dataCurta,
  diasParado,
  formatBRL,
  formatarTelefone,
  relativo,
  resumoSpecs,
  whatsappLink,
} from "@/lib/format";
import { STATUS_STYLE } from "@/lib/status-style";
import { cn, CONTAINER, HOVER_CARD } from "@/lib/utils";
import type { Captacao, Lista, Status } from "@/types";

/** Uma coluna no celular, duas no desktop, três em tela larga. */
const GRADE = "flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3 xl:grid-cols-3";

const GRUPOS: { status: Status; titulo: string }[] = [
  { status: "aguardando_informacoes", titulo: "Aguardando informações" },
  { status: "novas", titulo: "Novas" },
  { status: "em_decisao", titulo: "Em decisão" },
];

export default function DecidirPage() {
  const { cards, listas, vinculos, filtro, criterios, userId } = useApp();
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [engavetadasAbertas, setEngavetadasAbertas] = useState(false);

  const nums = useMemo(() => contadores(cards, hojeLocal(), userId), [cards, userId]);
  const porCaptacao = useMemo(() => indexarListas(vinculos, listas), [vinculos, listas]);

  const listasPorCaptacao = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos) {
      const atual = m.get(v.captacao_id);
      if (atual) atual.push(v.lista_id);
      else m.set(v.captacao_id, [v.lista_id]);
    }
    return m;
  }, [vinculos]);

  const naEtapa = useMemo(() => cards.filter((c) => etapaDaCaptacao(c) === "decidir"), [cards]);
  const visiveis = useMemo(
    () => filtrarPorCriterios(filtrarCaptacoes(naEtapa, filtro), criterios, { listasPorCaptacao }),
    [naEtapa, filtro, criterios, listasPorCaptacao]
  );

  // As engavetadas sem decisão não podem poluir a fila do dia, mas também não
  // podem sumir: vão para uma seção recolhida no fim, por data de revisão.
  const daFila = visiveis.filter((c) => !engavetadaSemDecisao(c));
  const engavetadas = useMemo(
    () => priorizarRevisaoGaveta(visiveis.filter(engavetadaSemDecisao)),
    [visiveis]
  );

  const grupos = GRUPOS.map((g) => ({ ...g, itens: daFila.filter((c) => c.status === g.status) }));
  // Conta sobre a etapa inteira, não sobre a fila filtrada: é o mesmo universo
  // do "N aguardando sua decisão" que aparece ao lado.
  const novas = naEtapa.filter((c) => c.status === "novas").length;
  const vazio = daFila.length === 0 && engavetadas.length === 0;

  return (
    <>
      <AppHeader
        titulo="Decidir"
        contadores={nums}
        onAbrirFiltros={() => setFiltrosAberto(true)}
        subtitulo={
          naEtapa.length === 0 ? (
            "Nada esperando decisão"
          ) : (
            // O tamanho da fila é o número que decide se dá para abrir o app
            // agora ou depois — por isso vem em corpo grande, e as novas (as
            // que ninguém olhou ainda) puxam o olho em dourado do outro lado.
            <span className="flex items-baseline gap-2">
              <span className="font-serif text-[26px] font-semibold leading-none text-white">
                {naEtapa.length}
              </span>
              <span>aguardando sua decisão</span>
              {novas > 0 && (
                <span className="ml-auto flex-none text-[12.5px] font-semibold text-primary">
                  {novas} nova{novas > 1 ? "s" : ""}
                </span>
              )}
            </span>
          )
        }
      />

      <div className={cn(CONTAINER, "no-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] pb-5 pt-4 [&>*]:shrink-0 lg:gap-3 lg:px-6 lg:pb-8")}>
        {vazio ? (
          <VazioDecidir />
        ) : (
          <>
            {grupos.map(
              (g) =>
                g.itens.length > 0 && (
                  <section key={g.status} className="flex flex-col gap-2.5">
                    <TituloGrupo titulo={g.titulo} total={g.itens.length} />
                    {/* No desktop a fila vira grade: o cartão foi desenhado para
                        ~380px e esticá-lo até 1180px só afasta o endereço dos
                        dois botões. Em coluna, cabem três de relance. */}
                    <div className={GRADE}>
                      {g.itens.map((c) => (
                        <CardDecisao key={c.id} captacao={c} listas={porCaptacao.get(c.id) ?? []} />
                      ))}
                    </div>
                  </section>
                )
            )}

            {engavetadas.length > 0 && (
              <section className="mt-2">
                <button
                  type="button"
                  onClick={() => setEngavetadasAbertas((v) => !v)}
                  aria-expanded={engavetadasAbertas}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-muted px-3.5 py-3.5 text-left"
                >
                  <span className="h-2 w-2 flex-none rounded-full bg-[#8a8fa8]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-foreground">
                      Engavetadas — reavaliar
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {engavetadas.length} sem decisão
                      {contarRevisaoVencida(engavetadas) > 0 &&
                        ` · ${contarRevisaoVencida(engavetadas)} com revisão vencida`}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 flex-none text-muted-foreground transition-transform",
                      engavetadasAbertas && "rotate-90"
                    )}
                  />
                </button>

                {engavetadasAbertas && (
                  <>
                    <p className="mt-2.5 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                      Estão aqui porque vieram das colunas Gaveta ou Seleção Especial sem decisão
                      registrada. Para tirar uma da gaveta, use o menu ⋯ do cartão → «Voltar para a
                      fila de decisão» — as listas continuam como estão.
                    </p>
                    <div className={cn(GRADE, "mt-2.5")}>
                      {engavetadas.map((c) => (
                        <CardDecisao key={c.id} captacao={c} listas={porCaptacao.get(c.id) ?? []} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <FiltrosSheet open={filtrosAberto} onOpenChange={setFiltrosAberto} universo={naEtapa} />
    </>
  );
}

function contarRevisaoVencida(cards: Captacao[]): number {
  const hoje = hojeLocal();
  return cards.filter((c) => c.gaveta_revisao_em != null && c.gaveta_revisao_em <= hoje).length;
}

/**
 * Separador de grupo: só o nome da etapa e quantas são. Sem ponto colorido nem
 * fio atravessando — a cor do status já vem no selo de cada cartão, e repetir
 * o código de cores no título deixava a fila listrada.
 */
function TituloGrupo({ titulo, total }: { titulo: string; total: number }) {
  return (
    <div className="flex items-center gap-2 pt-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {titulo}
      </span>
      <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-muted px-1.5 text-[10.5px] font-semibold text-muted-foreground">
        {total}
      </span>
    </div>
  );
}

/** Fita de chips do cartão — todos com o mesmo peso visual. */
const CHIP =
  "inline-flex h-[26px] items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 text-[11.5px] font-medium text-muted-foreground";

/**
 * Cartão da fila de decisão: tudo que trava a decisão à vista, e os dois
 * botões.
 *
 * O corpo abre o detalhe por um link esticado (`inset-0`) em vez de um
 * `<Link>` envolvendo tudo: o anúncio e o menu são interativos, e âncora
 * dentro de âncora é HTML inválido — o link do anúncio não abriria.
 */
function CardDecisao({ captacao, listas }: { captacao: Captacao; listas: Lista[] }) {
  const capa = useCapaUrl(captacao.capa_path);
  const opinioes = useApp((s) => s.opinioes[captacao.id]);
  const midia = useApp((s) => s.midia[captacao.id]) ?? MIDIA_VAZIA;
  const { decidir, beginSave, endSave } = useApp();
  const [reprovando, setReprovando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const estilo = STATUS_STYLE[captacao.status];
  const parada = diasParado(captacao.atualizado_em);
  const selo = rotuloMidia(midia);
  const totalMidia = midia.fotos + midia.videos;
  const zap = whatsappLink(captacao.whatsapp);
  const contato = [captacao.proprietario_nome, captacao.whatsapp && formatarTelefone(captacao.whatsapp)]
    .filter(Boolean)
    .join(" · ");

  async function aprovar() {
    if (!confirmarDecisao(captacao, "aprovada")) return;
    setSalvando(true);
    beginSave();
    const destino = destinoDecisao("aprovada");
    const ordem = await ordemFimDaColuna(destino);
    const supabase = createClient();
    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: destino,
      p_ordem: ordem,
      p_decisao: "aprovada",
    });
    setSalvando(false);
    endSave(!error);
    if (error) return toast.error("Não foi possível aprovar a captação.");
    decidir(captacao.id, "aprovada", destino);
    toast.success("Aprovada. Já entrou em Aprovadas, pronta para agendar.");
  }

  return (
    <article className={cn(
      "relative flex flex-col rounded-[18px] border bg-card p-[15px] shadow-[0_1px_2px_rgba(46,48,42,0.04),0_10px_24px_-18px_rgba(46,48,42,0.22)]",
      HOVER_CARD
    )}>
      <Link
        href={`/captacao/${captacao.id}`}
        className="absolute inset-0 z-0 rounded-[18px] focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Abrir ${captacao.endereco}`}
      />

      <div className="flex gap-3">
        {/* Capa com o selo de quantas mídias existem: "tem material?" é o que
            decide se dá para avaliar sem abrir o detalhe. */}
        <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl border bg-muted">
          {capa ? (
            <Image src={capa} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center">
              <Home className="h-4 w-4 text-muted-foreground/60" />
            </span>
          )}
          {totalMidia > 0 && (
            <span
              className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-md bg-black/65 px-1 py-px text-[10px] font-bold text-white"
              aria-label={selo ?? undefined}
            >
              <ImageIcon className="h-2.5 w-2.5" strokeWidth={2.4} aria-hidden />
              {totalMidia}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2.5">
            <h3 className="min-w-0 text-[16.5px] font-semibold leading-tight text-foreground [text-wrap:pretty]">
              {captacao.endereco}
              {captacao.unidade && <span className="text-muted-foreground"> / {captacao.unidade}</span>}
            </h3>

            {/* O tempo parada é o que ordena a atenção numa fila longa, então
                vira número grande no canto — e só quando já pesa (3 dias+).
                Antes disso a idade da captação é só contexto, em texto miúdo. */}
            <span className="relative z-10 flex flex-none items-start gap-0.5">
              {parada >= 3 ? (
                <span className="pt-px text-right">
                  <span className="block text-[19px] font-bold leading-none tracking-[-0.01em] text-foreground">
                    {parada}
                  </span>
                  <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    dias parada
                  </span>
                </span>
              ) : (
                <span className="pt-0.5 text-[11.5px] text-muted-foreground">
                  {relativo(captacao.criado_em)}
                </span>
              )}
              <MenuDaCaptacao captacao={captacao} />
            </span>
          </div>

          {captacao.bairro && (
            <p className="mt-1 text-[13px] font-medium text-muted-foreground">{captacao.bairro}</p>
          )}

          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{resumoSpecs(captacao)}</p>

          {captacao.valor_venda != null && (
            <p className="mt-2 text-base font-bold tracking-[-0.01em] text-foreground">
              {formatBRL(captacao.valor_venda)}
            </p>
          )}
        </div>
      </div>

      {/* Pendência não é exclusividade de "Aguardando informações": o campo é
          usado como "o que trava esta captação" em qualquer coluna, e preso ao
          status o texto não aparecia em lugar nenhum fora do detalhe. */}
      {captacao.pendencias && (
        <div className="mt-3 rounded-xl border border-[#eae2c4] bg-[#f7f3e8] p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9a8d3a]">
            <AlertTriangle className="h-3.5 w-3.5 flex-none" strokeWidth={2.2} />
            {captacao.status === "aguardando_informacoes" ? "Falta chegar" : "Pendência"}
          </p>
          <p className="text-[13px] leading-relaxed text-[#5f5a3f]">{captacao.pendencias}</p>
        </div>
      )}

      {captacao.gaveta_motivo && (
        <div className="mt-3 rounded-xl border bg-muted/60 p-3">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Engavetada
            {captacao.gaveta_revisao_em && ` · revisar em ${dataCurta(captacao.gaveta_revisao_em)}`}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/80">{captacao.gaveta_motivo}</p>
        </div>
      )}

      {/* Fita de contexto: status, com quem falar e o que já existe de material.
          Fica depois do que trava a captação e antes dos botões, na ordem em
          que a decisão é tomada — leio o problema, vejo com quem resolvo,
          decido. Tudo no mesmo cinza de propósito: o único código de cor aqui
          é o pontinho do status. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/* Contato do proprietário: sem ele a decisão para — quem aprova
            precisa ligar em seguida, e o número estava só no detalhe. */}
        {contato &&
          (zap ? (
            <a
              href={zap}
              target="_blank"
              rel="noreferrer"
              className={cn(CHIP, "relative z-10 min-w-0 hover:bg-muted")}
            >
              <MessageCircle className="h-3 w-3 flex-none" />
              <span className="truncate">{contato}</span>
            </a>
          ) : (
            <span className={cn(CHIP, "min-w-0")}>
              <span className="truncate">{contato}</span>
            </span>
          ))}

        <span className={CHIP}>
          <span className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: estilo.dot }} />
          {estilo.short}
        </span>

        {captacao.anuncio_url && (
          <a
            href={captacao.anuncio_url}
            target="_blank"
            rel="noreferrer"
            className={cn(CHIP, "relative z-10 hover:bg-muted")}
          >
            <Link2 className="h-3 w-3 flex-none" />
            Anúncio
          </a>
        )}

        {selo && (
          <span className={CHIP}>
            <ImageIcon className="h-3 w-3 flex-none" />
            {selo}
          </span>
        )}

        {/* Opiniões não lidas mantêm a cor: é a única coisa desta fita que
            pede uma ação antes de decidir. */}
        {opinioes?.naoLidas ? (
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-lg border border-[#d8e7df] bg-[#eef4f0] px-2.5 text-[11.5px] font-semibold text-[#2f6b46]">
            <MessageSquare className="h-3 w-3 flex-none" />
            {opinioes.naoLidas} nova{opinioes.naoLidas > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {listas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
        </div>
      )}

      {/* Aprovar é o caminho esperado e vem preenchido; reprovar é a exceção e
          fica em contorno. Os dois lado a lado e do mesmo tamanho porque a
          escolha é de quem decide, não do botão mais bonito. */}
      <div className="relative z-10 mt-3.5 flex gap-2.5 lg:mt-auto lg:pt-3.5">
        <button
          type="button"
          onClick={aprovar}
          disabled={salvando}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2f6b46] py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Check className="h-4 w-4" strokeWidth={2.3} />
          Aprovar
        </button>
        <button
          type="button"
          onClick={() => setReprovando(true)}
          disabled={salvando}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e2bebe] bg-card py-3 text-sm font-semibold text-[#9a3b3b] disabled:opacity-60"
        >
          <X className="h-4 w-4" strokeWidth={2.3} />
          Reprovar
        </button>
      </div>

      {captacao.criado_por && <Autor userId={captacao.criado_por} />}

      <ReprovarDialog captacao={captacao} open={reprovando} onOpenChange={setReprovando} />
    </article>
  );
}

function Autor({ userId }: { userId: string }) {
  const perfil = useApp((s) => s.perfis.find((p) => p.user_id === userId));
  if (!perfil) return null;
  return (
    <div className="mt-3 flex items-center gap-2 border-t pt-3">
      <Avatar nome={perfil.nome} size={24} />
      <span className="text-[12.5px] text-muted-foreground">{perfil.nome}</span>
    </div>
  );
}
