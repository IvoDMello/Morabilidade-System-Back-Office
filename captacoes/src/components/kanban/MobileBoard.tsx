"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  LogOut,
  Search,
  X,
  Plus,
  ChevronDown,
  BedDouble,
  DoorOpen,
  Bath,
  Car,
  Scan,
  Check,
  User,
  Link2,
  Images,
  ArrowRightLeft,
  CalendarDays,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { BoardControls } from "@/components/board/BoardControls";
import { NovaCaptacaoButton } from "@/components/captacao/NovaCaptacaoButton";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { FotosLightbox, type FotoRef } from "@/components/captacao/FotosLightbox";
import { formatBRL, dataCurta, diasRestantes } from "@/lib/format";
import { useBoard } from "@/stores/board";
import { STATUS_STYLE, PILL_ORDER } from "@/lib/status-style";
import { iniciaisNome } from "@/lib/opinioes";
import type { Captacao, Decisao, Status } from "@/types";

function StatusBadge({ status, full = false }: { status: Status; full?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.dot }} />
      {full ? s.label : s.short}
    </span>
  );
}

function MobileCard({
  card,
  onDecidir,
  onMover,
}: {
  card: Captacao;
  onDecidir: (c: Captacao, d: Decisao) => void;
  onMover: (c: Captacao, s: Status) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const opinioes = useBoard((s) => s.opinioes[card.id]);
  const [fotos, setFotos] = useState<FotoRef[] | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const router = useRouter();
  const naDecisao = card.status === "em_decisao" && !card.decisao;
  const prazoDecisao = naDecisao && card.em_decisao_desde ? diasRestantes(card.em_decisao_desde) : null;
  const revisarGaveta =
    card.status === "gaveta" && card.gaveta_revisao_em
      ? new Date(card.gaveta_revisao_em + "T00:00:00").getTime() <= Date.now()
      : false;

  // Abre as fotos da captação direto do quadro (busca sob demanda na 1ª vez).
  async function abrirFotos() {
    if (fotos) {
      setViewer(0);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("midia")
      .select("id,storage_path,tipo,ordem")
      .eq("captacao_id", card.id)
      .eq("tipo", "foto")
      .order("ordem");
    const lista = ((data ?? []) as FotoRef[]).filter((f) => f.storage_path);
    setFotos(lista);
    if (lista.length > 0) setViewer(0);
  }

  const specs: { icon: typeof BedDouble; valor: string; title: string }[] = [];
  if (card.quartos != null) specs.push({ icon: BedDouble, valor: String(card.quartos), title: "Quartos" });
  if (card.suites != null && card.suites > 0) specs.push({ icon: DoorOpen, valor: `${card.suites} suíte`, title: "Suítes" });
  if (card.banheiros != null) specs.push({ icon: Bath, valor: String(card.banheiros), title: "Banheiros" });
  if (card.vagas != null && card.vagas > 0) specs.push({ icon: Car, valor: String(card.vagas), title: "Vagas" });
  if (card.metragem != null) specs.push({ icon: Scan, valor: `${card.metragem}m²`, title: "Metragem" });

  function abrirDetalhe() {
    router.push(`/captacao/${card.id}`);
  }

  return (
    <Card
      onClick={abrirDetalhe}
      className="cursor-pointer space-y-3 rounded-[18px] border-[#e8e9e3] p-[17px] shadow-[0_1px_2px_rgba(46,48,42,0.04),0_10px_24px_-16px_rgba(46,48,42,0.22)] transition-shadow active:shadow-sm"
    >
      {/* Linha topo: badge + indicador de fotos + expandir */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={card.status} />
          {prazoDecisao != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold",
                prazoDecisao <= 0
                  ? "bg-[#f0e2e2] text-[#7a3434]"
                  : prazoDecisao <= 2
                    ? "bg-[#f7ecd9] text-[#8f6320]"
                    : "bg-[#ebece7] text-[#5f6157]"
              )}
            >
              {prazoDecisao > 0
                ? `decidir em ${prazoDecisao}d`
                : prazoDecisao === 0
                  ? "decidir hoje"
                  : `atrasada ${-prazoDecisao}d`}
            </span>
          )}
          {opinioes && opinioes.total > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold",
                opinioes.naoLidas > 0 ? "bg-[#faf7e8] text-[#857727]" : "bg-[#ebece7] text-[#5f6157]"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {opinioes.naoLidas > 0
                ? `${opinioes.naoLidas} nova${opinioes.naoLidas > 1 ? "s" : ""}`
                : opinioes.total}
            </span>
          )}
          {card.status === "gaveta" && card.gaveta_revisao_em && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold",
                revisarGaveta ? "bg-[#f0e2e2] text-[#7a3434]" : "bg-[#e9eaf0] text-[#565b72]"
              )}
            >
              {revisarGaveta ? "revisar agora" : `revisar ${dataCurta(card.gaveta_revisao_em)}`}
            </span>
          )}
          {card.capa_path ? (
            // Tem fotos: chip abre o visualizador (o anúncio, se houver, vai pro expandir).
            <button
              type="button"
              title="Ver fotos"
              onClick={(e) => {
                e.stopPropagation();
                abrirFotos();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#ebece6] bg-[#f5f6f1] px-2 py-1 text-xs font-medium text-[#6e7063] active:bg-[#ebece6]"
            >
              <Images className="h-3.5 w-3.5 text-[#888b7e]" /> Fotos
            </button>
          ) : (
            card.anuncio_url && (
              // Sem fotos, mas tem anúncio: chip abre o link direto.
              <a
                href={card.anuncio_url}
                target="_blank"
                rel="noreferrer"
                title="Ver anúncio"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-lg border border-[#ece4b8] bg-[#faf7e8] px-2 py-1 text-xs font-medium text-[#9a8d3a] active:brightness-95"
              >
                <Link2 className="h-3.5 w-3.5" /> Anúncio
              </a>
            )
          )}
        </div>
        <button
          type="button"
          aria-label={aberto ? "Recolher" : "Expandir"}
          onClick={(e) => {
            e.stopPropagation();
            setAberto((v) => !v);
          }}
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[#f3f4f0] text-[#585a4f]"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
        </button>
      </div>

      {/* Endereço */}
      <p className="text-[17px] font-semibold leading-[1.28] text-[#2e302a]">{card.endereco}</p>

      {/* Proprietário (sempre visível) */}
      {card.proprietario_nome && (
        <p className="inline-flex items-center gap-1.5 text-[13px] text-[#6e7063]">
          <User className="h-3.5 w-3.5" /> {card.proprietario_nome}
        </p>
      )}

      {/* Specs */}
      {specs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {specs.map((s, i) => (
            <span
              key={i}
              title={s.title}
              className="inline-flex items-center gap-1 rounded-[9px] border border-[#ebece6] bg-[#f5f6f1] px-2 py-1 text-[13px] text-[#585a4f]"
            >
              <s.icon className="h-3.5 w-3.5 text-[#888b7e]" /> {s.valor}
            </span>
          ))}
        </div>
      )}

      {/* Valores */}
      {(card.valor_venda != null || card.valor_condominio != null) && (
        <div className="flex items-end justify-between gap-3 border-t border-[#eef0ea] pt-3">
          {card.valor_venda != null && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9a9c90]">Venda</p>
              <p className="text-[16.5px] font-bold text-[#3d3f36]">{formatBRL(card.valor_venda)}</p>
            </div>
          )}
          {card.valor_condominio != null && (
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9a9c90]">Condomínio</p>
              <p className="text-[14px] font-semibold text-[#6e7063]">{formatBRL(card.valor_condominio)}</p>
            </div>
          )}
        </div>
      )}

      {/* Motivo da gaveta (sempre visível na coluna Gaveta) */}
      {card.status === "gaveta" && card.gaveta_motivo && (
        <p className="text-[13px] italic text-[#6e7063]">{card.gaveta_motivo}</p>
      )}

      {/* Data de cadastro */}
      <p className="inline-flex items-center gap-1.5 text-xs text-[#9a9c90]">
        <CalendarDays className="h-3.5 w-3.5" /> Cadastrada em {dataCurta(card.criado_em)}
      </p>

      {/* Expandido */}
      {aberto && (
        <div className="space-y-2 border-t border-dashed border-[#dcddd6] pt-3">
          {card.anuncio_url && card.capa_path && (
            <a
              href={card.anuncio_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#9a8d3a]"
            >
              <Link2 className="h-3.5 w-3.5" /> Ver anúncio publicado
            </a>
          )}

          {/* Mover para outra etapa (equivale ao arrastar do desktop) */}
          <div className="pt-1">
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#9a9c90]">
              <ArrowRightLeft className="h-3 w-3" /> Mover para
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PILL_ORDER.filter((s) => s !== card.status).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMover(card, s);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e3dd] bg-white px-2.5 py-1.5 text-xs font-medium text-[#4a4d43] active:bg-[#eceee8]"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_STYLE[s].dot }} />
                  {STATUS_STYLE[s].short}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Decisão (versões suaves) — só na coluna de decisão */}
      {naDecisao && (
        <div className="flex gap-2 border-t border-[#eef0ea] pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDecidir(card, "aprovada");
            }}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#c3e0cd] bg-[#ecf5ef] text-sm font-semibold text-[#2f6b46] active:brightness-95"
          >
            <Check className="h-4 w-4" /> Aprovar
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDecidir(card, "reprovada");
            }}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e6c5c5] bg-[#f7ecec] text-sm font-semibold text-[#9a3b3b] active:brightness-95"
          >
            <X className="h-4 w-4" /> Reprovar
          </button>
        </div>
      )}

      {fotos && <FotosLightbox fotos={fotos} index={viewer} onClose={() => setViewer(null)} />}
    </Card>
  );
}

export function MobileBoard({
  byStatus,
  visiveis,
  onDecidir,
  onMover,
  userEmail,
  userNome,
}: {
  byStatus: Record<Status, Captacao[]>;
  visiveis: (cards: Captacao[]) => Captacao[];
  onDecidir: (c: Captacao, d: Decisao) => void;
  onMover: (c: Captacao, s: Status) => void;
  userEmail: string;
  userNome: string;
}) {
  const router = useRouter();
  // Aba de status vem do store: sobrevive à ida ao detalhe e volta ao quadro.
  const { filtro, setFiltro, filtroStatus: filtro_, setFiltroStatus, opinioes } = useBoard();
  const naoLidas = Object.values(opinioes).reduce((n, o) => n + o.naoLidas, 0);

  const todas = useMemo(() => PILL_ORDER.flatMap((s) => byStatus[s]), [byStatus]);
  const filtradas = useMemo(() => visiveis(todas), [visiveis, todas]);
  const counts = useMemo(() => {
    const m = {} as Record<Status, number>;
    for (const s of PILL_ORDER) m[s] = 0;
    for (const c of filtradas) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [filtradas]);

  const lista = filtro_ === "all" ? filtradas : filtradas.filter((c) => c.status === filtro_);

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative flex h-full flex-col bg-[#f3f4f0]">
      {/* Header olive (hero) */}
      <header
        className="px-[18px] pb-[22px] pt-[18px] text-[#f3f4f0]"
        style={{ background: "linear-gradient(150deg,#2c2e28 0%,#585a4f 58%,#454840 100%)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d8cb6a]">Captações</p>
            <h1 className="mt-1 font-serif text-[30px] font-semibold leading-none">Seu quadro</h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#cfd0c9]">
              <LayoutGrid className="h-4 w-4" /> {todas.length} no quadro
              {naoLidas > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#d8cb6a] px-2 py-0.5 text-xs font-bold text-[#3a3408]">
                  <MessageSquare className="h-3 w-3" /> {naoLidas}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
              style={{ backgroundColor: "#d8cb6a", color: "#3a3408" }}
              title={`${userNome} · ${userEmail}`}
            >
              {iniciaisNome(userNome)}
            </div>
            <button
              type="button"
              onClick={sair}
              aria-label="Sair"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#f3f4f0]/80 hover:bg-white/10"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#f3f4f0]/70" />
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Endereço, proprietário ou telefone…"
              className="h-11 w-full rounded-[11px] border border-white/[0.18] bg-white/[0.14] pl-9 pr-9 text-sm text-[#f3f4f0] placeholder:text-[#f3f4f0]/60 outline-none focus:border-white/40"
            />
            {filtro.trim() && (
              <button
                type="button"
                onClick={() => setFiltro("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#f3f4f0]/70 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sub-header sticky: ordenação/filtros + pills */}
      <div className="sticky top-0 z-10 border-b border-[#e2e3dd] bg-[#f3f4f0]/[0.92] backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <BoardControls />
          <span className="text-xs text-[#9a9c90]">Toque para analisar</span>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          <Pill ativo={filtro_ === "all"} onClick={() => setFiltroStatus("all")} label="Todas" count={filtradas.length} />
          {PILL_ORDER.map((s) => (
            <Pill
              key={s}
              ativo={filtro_ === s}
              onClick={() => setFiltroStatus(s)}
              label={STATUS_STYLE[s].short}
              count={counts[s]}
              dot={STATUS_STYLE[s].dot}
            />
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 space-y-[14px] overflow-y-auto px-4 pb-28 pt-[18px]">
        {lista.map((c) => (
          <MobileCard key={c.id} card={c} onDecidir={onDecidir} onMover={onMover} />
        ))}
        {lista.length === 0 && (
          <div className="mt-12 text-center text-sm text-[#9a9c90]">
            {filtro.trim() ? `Nenhuma captação para “${filtro}”.` : "Nenhuma captação nesta visão."}
          </div>
        )}
      </div>

      {/* FAB */}
      <NovaCaptacaoButton
        trigger={
          <button
            type="button"
            aria-label="Nova captação"
            className="absolute bottom-[26px] right-[22px] flex h-[60px] w-[60px] items-center justify-center rounded-[20px] shadow-[0_12px_28px_-8px_rgba(157,141,58,0.6)]"
            style={{ background: "linear-gradient(150deg,#e0d27a,#c5b54a)", color: "#3a3408" }}
          >
            <Plus className="h-7 w-7" />
          </button>
        }
      />
    </div>
  );
}

function Pill({
  ativo,
  onClick,
  label,
  count,
  dot,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        ativo ? "border-[#585a4f] bg-[#585a4f] text-[#f3f4f0]" : "border-[#e2e3dd] bg-white text-[#4a4d43]"
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: ativo ? "#f3f4f0" : dot ?? "#b0b2a8" }}
      />
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px]", ativo ? "bg-white/20" : "bg-[#eceee8] text-[#6e7063]")}>
        {count}
      </span>
    </button>
  );
}
