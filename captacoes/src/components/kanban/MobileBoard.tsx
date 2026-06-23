"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BedDouble, Bath, AlertTriangle, MessageCircle, User, ChevronRight, ChevronDown, Link2, Hotel, Ruler, Car, Clock, Calendar, Pin, PinOff, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { signedUrl } from "@/lib/storage";
import { whatsappLink, formatarTelefone, formatBRL, relativo, dataCurta, diasParado } from "@/lib/format";
import { STATUSES, STATUS_LABEL, STATUS_TONE, type Captacao, type Decisao, type Status } from "@/types";

const TONE_DOT: Record<string, string> = {
  muted: "bg-muted-foreground/40",
  primary: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  positive: "bg-positive",
};

/** Aba padrão por dispositivo: lembra a última coluna escolhida (ou a fixada). */
const ABA_KEY = "morab:mobile-aba";

function lerAbaSalva(): Status | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ABA_KEY);
  return v && STATUSES.includes(v as Status) ? (v as Status) : null;
}

function MobileCard({
  card,
  onMover,
  onDecidir,
}: {
  card: Captacao;
  onMover: (c: Captacao, s: Status) => void;
  onDecidir: (c: Captacao, d: Decisao) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!card.capa_path || !aberto) return;
    let ativo = true;
    signedUrl(card.capa_path, 3600).then((u) => ativo && setCapaUrl(u)).catch(() => {});
    return () => {
      ativo = false;
    };
  }, [card.capa_path, aberto]);

  const temPendencia = card.status === "aguardando_informacoes" && card.pendencias?.trim();
  const wa = whatsappLink(card.whatsapp);
  const parado = diasParado(card.atualizado_em);
  const alertaParado = card.status === "aguardando_informacoes" && parado >= 3;
  const agendamento = card.status === "pendente_agendar_visita" || card.status === "pendente_agendar_gravacao";
  const naDecisao = card.status === "em_decisao" && !card.decisao;

  // Resumo de cômodos exibido já na linha compacta (sem precisar expandir).
  const specs: { icon: typeof BedDouble; valor: string; title: string }[] = [];
  if (card.quartos != null) specs.push({ icon: BedDouble, valor: String(card.quartos), title: "Quartos" });
  if (card.suites != null) specs.push({ icon: Hotel, valor: String(card.suites), title: "Suítes" });
  if (card.banheiros != null) specs.push({ icon: Bath, valor: String(card.banheiros), title: "Banheiros" });
  if (card.vagas != null) specs.push({ icon: Car, valor: String(card.vagas), title: "Vagas" });
  if (card.metragem != null) specs.push({ icon: Ruler, valor: `${card.metragem}m²`, title: "Metragem" });

  return (
    <Card className={cn("overflow-hidden", temPendencia && "border-l-4 border-l-destructive")}>
      {/* Linha compacta — já mostra o essencial; toca para expandir */}
      <button onClick={() => setAberto((v) => !v)} className="flex w-full items-start gap-2 p-3 text-left">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 truncate font-medium leading-snug">{card.endereco}</p>
            {temPendencia && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
            <ChevronDown className={cn("mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {card.valor_venda != null && (
              <span className="text-sm font-semibold text-primary">{formatBRL(card.valor_venda)}</span>
            )}
            {card.proprietario_nome && (
              <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{card.proprietario_nome}</span>
              </span>
            )}
          </div>

          {specs.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              {specs.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1" title={s.title}>
                  <s.icon className="h-3.5 w-3.5" /> {s.valor}
                </span>
              ))}
            </div>
          )}

          {/* Indicadores rápidos sempre visíveis */}
          {(card.decisao || alertaParado || agendamento) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {card.decisao && (
                <Badge variant={card.decisao === "aprovada" ? "positive" : "destructive"} className="text-[10px]">
                  {card.decisao}
                </Badge>
              )}
              {alertaParado && !card.decisao && (
                <Badge variant="destructive" className="text-[10px]">parada {parado}d</Badge>
              )}
              {agendamento && (
                <>
                  <Badge variant={card.visita_concluida ? "positive" : "muted"} className="gap-1 text-[10px]">
                    <Calendar className="h-3 w-3" /> Visita {dataCurta(card.visita_data)}
                  </Badge>
                  <Badge variant={card.gravacao_concluida ? "positive" : "muted"} className="gap-1 text-[10px]">
                    <Calendar className="h-3 w-3" /> Gravação {dataCurta(card.gravacao_data)}
                  </Badge>
                </>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Ação rápida de decisão — sempre visível na coluna de decisão */}
      {naDecisao && (
        <div className="flex gap-2 border-t px-3 py-2.5">
          <button
            onClick={() => onDecidir(card, "aprovada")}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-positive/10 text-sm font-medium text-positive active:bg-positive/20"
          >
            <Check className="h-4 w-4" /> Aprovar
          </button>
          <button
            onClick={() => onDecidir(card, "reprovada")}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive/10 text-sm font-medium text-destructive active:bg-destructive/20"
          >
            <X className="h-4 w-4" /> Reprovar
          </button>
        </div>
      )}

      {/* Detalhes — só quando expandido */}
      {aberto && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          {capaUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
              <Image src={capaUrl} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          )}

          {temPendencia && (
            <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{card.pendencias}</span>
            </div>
          )}

          {card.observacoes?.trim() && (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{card.observacoes}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-positive/10 px-2 py-1 text-xs font-medium text-positive"
              >
                <MessageCircle className="h-3.5 w-3.5" /> {formatarTelefone(card.whatsapp)}
              </a>
            )}
            {card.anuncio_url && (
              <a
                href={card.anuncio_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
              >
                <Link2 className="h-3.5 w-3.5" /> Anúncio
              </a>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {relativo(card.criado_em)}
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Mover para coluna"
              value={card.status}
              onChange={(e) => onMover(card, e.target.value as Status)}
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <Link
              href={`/captacao/${card.id}`}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 text-xs font-medium"
            >
              Abrir <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

export function MobileBoard({
  byStatus,
  visiveis,
  onMover,
  onDecidir,
}: {
  byStatus: Record<Status, Captacao[]>;
  visiveis: (cards: Captacao[]) => Captacao[];
  onMover: (c: Captacao, s: Status) => void;
  onDecidir: (c: Captacao, d: Decisao) => void;
}) {
  const [aba, setAba] = useState<Status>("aguardando_informacoes");
  const [fixada, setFixada] = useState<Status | null>(null);

  // Ao abrir: restaura a coluna padrão escolhida neste aparelho.
  useEffect(() => {
    const salva = lerAbaSalva();
    if (salva) {
      setFixada(salva);
      setAba(salva);
    }
  }, []);

  function escolherAba(s: Status) {
    setAba(s);
    // Se há uma coluna fixada, navegar a outra não muda o padrão.
    if (!fixada && typeof window !== "undefined") {
      window.localStorage.setItem(ABA_KEY, s);
    }
  }

  function alternarFixar() {
    if (fixada === aba) {
      setFixada(null);
      if (typeof window !== "undefined") window.localStorage.removeItem(ABA_KEY);
    } else {
      setFixada(aba);
      if (typeof window !== "undefined") window.localStorage.setItem(ABA_KEY, aba);
    }
  }

  const cards = visiveis(byStatus[aba]);

  return (
    <div className="flex h-full flex-col">
      {/* abas de status com rolagem horizontal */}
      <div className="flex items-center gap-2 px-3 pb-3">
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {STATUSES.map((s) => {
            const n = byStatus[s].length;
            const ativa = s === aba;
            return (
              <button
                key={s}
                onClick={() => escolherAba(s)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  ativa ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", TONE_DOT[STATUS_TONE[s]])} />
                {STATUS_LABEL[s]}
                {fixada === s && <Pin className="h-3 w-3 text-primary" />}
                <span className="rounded-full bg-muted px-1.5 text-[10px]">{n}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={alternarFixar}
          aria-label={fixada === aba ? "Desafixar coluna padrão" : "Fixar como coluna padrão"}
          title={fixada === aba ? "Desafixar coluna padrão" : "Abrir sempre nesta coluna"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            fixada === aba ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          )}
        >
          {fixada === aba ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {cards.map((c) => (
          <MobileCard key={c.id} card={c} onMover={onMover} onDecidir={onDecidir} />
        ))}
        {cards.length === 0 && (
          <div className="mt-10 text-center text-sm text-muted-foreground">Nenhuma captação nesta coluna.</div>
        )}
      </div>
    </div>
  );
}
