"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BedDouble, Bath, AlertTriangle, GripVertical, User, Calendar, Clock, DoorOpen, MessageCircle, Link2, Hotel, Ruler, Car } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativo, dataCurta, diasParado, whatsappLink, formatarTelefone, formatBRL } from "@/lib/format";
import { signedUrl } from "@/lib/storage";
import type { Captacao } from "@/types";

// cache simples por sessão para não re-assinar a mesma capa a cada render
const capaCache = new Map<string, string>();

export function CaptacaoCard({ card, overlay = false }: { card: Captacao; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card },
  });

  const [capaUrl, setCapaUrl] = useState<string | null>(
    card.capa_path ? capaCache.get(card.capa_path) ?? null : null
  );

  useEffect(() => {
    const path = card.capa_path;
    if (!path || capaCache.has(path)) return;
    let ativo = true;
    signedUrl(path, 3600)
      .then((u) => {
        capaCache.set(path, u);
        if (ativo) setCapaUrl(u);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [card.capa_path]);

  const style = { transform: CSS.Translate.toString(transform), transition };
  const temPendencia = card.status === "aguardando_informacoes" && card.pendencias?.trim();
  const parado = diasParado(card.atualizado_em);
  const alertaParado = card.status === "aguardando_informacoes" && parado >= 3;
  const agendamento = card.status === "pendente_agendar_visita" || card.status === "pendente_agendar_gravacao";

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative select-none border-l-4 p-3 text-sm transition-shadow hover:shadow-md",
        temPendencia ? "border-l-destructive" : "border-l-transparent",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-xl ring-2 ring-primary"
      )}
    >
      <button
        className="absolute right-1.5 top-1.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-40 outline-none transition-opacity hover:bg-muted group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Arrastar (use as setas do teclado para mover)"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Link href={`/captacao/${card.id}`} className="block pr-5">
        {capaUrl && (
          <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-md bg-muted">
            <Image src={capaUrl} alt="" fill sizes="280px" className="object-cover" />
          </div>
        )}
        <p className="font-medium leading-snug">{card.endereco}</p>

        {card.valor_venda != null && (
          <p className="mt-1 text-sm font-semibold text-primary">{formatBRL(card.valor_venda)}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {card.quartos != null && (
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {card.quartos}
            </span>
          )}
          {card.suites != null && (
            <span className="inline-flex items-center gap-1" title="Suítes">
              <Hotel className="h-3.5 w-3.5" /> {card.suites}
            </span>
          )}
          {card.banheiros != null && (
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {card.banheiros}
            </span>
          )}
          {card.vagas != null && (
            <span className="inline-flex items-center gap-1" title="Vagas">
              <Car className="h-3.5 w-3.5" /> {card.vagas}
            </span>
          )}
          {card.metragem != null && (
            <span className="inline-flex items-center gap-1" title="Metragem">
              <Ruler className="h-3.5 w-3.5" /> {card.metragem} m²
            </span>
          )}
          {card.tipo_portaria && (
            <span className="inline-flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5" /> {card.tipo_portaria}
            </span>
          )}
          {card.proprietario_nome && (
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-3.5 w-3.5" /> {card.proprietario_nome}
            </span>
          )}
        </div>

        {temPendencia && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{card.pendencias}</span>
          </div>
        )}

        {agendamento && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <Badge variant={card.visita_concluida ? "positive" : "muted"} className="gap-1">
              <Calendar className="h-3 w-3" /> Visita {dataCurta(card.visita_data)}
            </Badge>
            <Badge variant={card.gravacao_concluida ? "positive" : "muted"} className="gap-1">
              <Calendar className="h-3 w-3" /> Gravação {dataCurta(card.gravacao_data)}
            </Badge>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {relativo(card.criado_em)}
          </span>
          {card.decisao && (
            <Badge variant={card.decisao === "aprovada" ? "positive" : "destructive"} className="text-[10px]">
              {card.decisao}
            </Badge>
          )}
          {alertaParado && !card.decisao && (
            <span className="font-medium text-destructive">parada {parado}d</span>
          )}
        </div>
      </Link>

      {(card.whatsapp || card.anuncio_url) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.whatsapp && whatsappLink(card.whatsapp) && (
            <a
              href={whatsappLink(card.whatsapp)!}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-md bg-positive/10 px-2 py-1 text-xs font-medium text-positive transition-colors hover:bg-positive/20"
              title="Abrir conversa no WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" /> {formatarTelefone(card.whatsapp)}
            </a>
          )}
          {card.anuncio_url && (
            <a
              href={card.anuncio_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              title="Abrir anúncio"
            >
              <Link2 className="h-3.5 w-3.5" /> Anúncio
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
