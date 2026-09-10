"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ImageIcon,
  ImageOff,
  Link2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Timer,
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
import { dataCurta, diasParado, formatBRL, formatarTelefone, relativo, whatsappLink } from "@/lib/format";
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
  const vazio = daFila.length === 0 && engavetadas.length === 0;

  return (
    <>
      <AppHeader
        titulo="Decidir"
        contadores={nums}
        onAbrirFiltros={() => setFiltrosAberto(true)}
        subtitulo={
          naEtapa.length === 0 ? "Nada esperando decisão" : `${naEtapa.length} aguardando sua decisão`
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
                    <TituloGrupo status={g.status} titulo={g.titulo} total={g.itens.length} />
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

function TituloGrupo({ status, titulo, total }: { status: Status; titulo: string; total: number }) {
  return (
    <div className="flex items-center gap-2 pt-1.5">
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_STYLE[status].dot }} />
      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {titulo}
      </span>
      <span className="text-[11px] font-semibold text-muted-foreground/70">{total}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

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

      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="inline-flex h-6 flex-none items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold"
            style={{ background: estilo.bg, color: estilo.fg }}
          >
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: estilo.dot }} />
            {estilo.short}
          </span>

          {/* Marcador, não o texto: o aviso tem de ser legível de relance numa
              fila longa, e um trecho truncado aqui brigaria por espaço com o
              selo e o "parada há X dias". O texto inteiro fica no box abaixo. */}
          {captacao.pendencias && (
            <span className="inline-flex h-6 min-w-0 items-center gap-1 rounded-lg border border-[#eae2c4] bg-[#f7f3e8] px-2 text-[11.5px] font-semibold text-[#857727]">
              <AlertTriangle className="h-3 w-3 flex-none" strokeWidth={2.4} />
              <span className="truncate">Pendência</span>
            </span>
          )}
        </span>

        <span className="relative z-10 flex flex-none items-center gap-2 whitespace-nowrap">
          {opinioes?.naoLidas ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#eef4f0] px-2 py-0.5 text-[11.5px] font-semibold text-[#2f6b46]">
              <MessageSquare className="h-3 w-3" />
              {opinioes.naoLidas} nova{opinioes.naoLidas > 1 ? "s" : ""}
            </span>
          ) : null}
          {parada >= 3 ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#a06a4a]">
              <Timer className="h-3 w-3" />
              parada há {parada} dias
            </span>
          ) : (
            <span className="text-[11.5px] text-muted-foreground">{relativo(captacao.criado_em)}</span>
          )}
          <MenuDaCaptacao captacao={captacao} />
        </span>
      </div>

      <div className="flex gap-3">
        {/* Capa com o selo de quantas mídias existem: "tem material?" é o que
            decide se dá para avaliar sem abrir o detalhe. */}
        <div className="relative h-[62px] w-[62px] flex-none overflow-hidden rounded-xl border bg-muted">
          {capa ? (
            <Image src={capa} alt="" fill sizes="62px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center">
              <ImageOff className="h-4 w-4 text-muted-foreground/60" />
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
          <h3 className="text-[16.5px] font-semibold leading-tight text-foreground [text-wrap:pretty]">
            {captacao.endereco}
            {captacao.unidade && <span className="text-muted-foreground"> / {captacao.unidade}</span>}
          </h3>

          {captacao.bairro && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-[#9a8d3a]" />
              {captacao.bairro}
            </p>
          )}

          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{resumoSpecs(captacao)}</p>

          {captacao.valor_venda != null && (
            <p className="mt-2 text-base font-bold tracking-[-0.01em] text-foreground">
              {formatBRL(captacao.valor_venda)}
            </p>
          )}
        </div>
      </div>

      {(contato || captacao.anuncio_url || selo) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {/* Contato do proprietário: sem ele a decisão para — quem aprova
              precisa ligar em seguida, e o número estava só no detalhe. */}
          {contato &&
            (zap ? (
              <a
                href={zap}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 inline-flex h-6 items-center gap-1.5 rounded-md border border-[#d8e7df] bg-[#eef4f0] px-2.5 text-[11.5px] font-semibold text-[#2f6b46] hover:bg-[#e4eee9]"
              >
                <MessageCircle className="h-3 w-3" />
                {contato}
              </a>
            ) : (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-md border bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
                {contato}
              </span>
            ))}
          {captacao.anuncio_url && (
            <a
              href={captacao.anuncio_url}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 inline-flex h-6 items-center gap-1.5 rounded-md border border-[#ece4b8] bg-[#faf7e8] px-2.5 text-[11.5px] font-semibold text-[#9a8d3a] hover:bg-[#f5efd8]"
            >
              <Link2 className="h-3 w-3" />
              Ver anúncio
            </a>
          )}
          {selo && (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-md border bg-muted px-2.5 text-[11.5px] font-semibold text-muted-foreground">
              <ImageIcon className="h-3 w-3" />
              {selo}
            </span>
          )}
        </div>
      )}

      {/* Pendência não é exclusividade de "Aguardando informações": o campo é
          usado como "o que trava esta captação" em qualquer coluna, e preso ao
          status o texto não aparecia em lugar nenhum fora do detalhe. */}
      {captacao.pendencias && (
        <div className="mt-3 rounded-xl border border-[#eae2c4] bg-[#f7f3e8] p-3">
          <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#9a8d3a]">
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

      <div className="relative z-10 mt-3.5 flex gap-2.5 lg:mt-auto lg:pt-3.5">
        <button
          type="button"
          onClick={aprovar}
          disabled={salvando}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#c3e0cd] bg-[#ecf5ef] py-3 text-sm font-semibold text-[#2f6b46] disabled:opacity-60"
        >
          <Check className="h-4 w-4" strokeWidth={2.3} />
          Aprovar
        </button>
        <button
          type="button"
          onClick={() => setReprovando(true)}
          disabled={salvando}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e6c5c5] bg-[#f7ecec] py-3 text-sm font-semibold text-[#9a3b3b] disabled:opacity-60"
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

function resumoSpecs(c: Captacao): string {
  const partes: string[] = [];
  if (c.quartos != null) partes.push(`${c.quartos} ${c.quartos === 1 ? "quarto" : "quartos"}`);
  if (c.suites) partes.push(`${c.suites} ${c.suites === 1 ? "suíte" : "suítes"}`);
  if (c.banheiros != null) partes.push(`${c.banheiros} ${c.banheiros === 1 ? "banheiro" : "banheiros"}`);
  if (c.vagas) partes.push(`${c.vagas} ${c.vagas === 1 ? "vaga" : "vagas"}`);
  if (c.metragem != null) partes.push(`${c.metragem} m²`);
  return partes.join(" · ");
}
