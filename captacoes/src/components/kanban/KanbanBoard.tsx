"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { KanbanColumn } from "./KanbanColumn";
import { CaptacaoCard } from "./CaptacaoCard";
import { MobileBoard } from "./MobileBoard";
import { NovaCaptacaoButton } from "@/components/captacao/NovaCaptacaoButton";
import { useBoard } from "@/stores/board";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import { filtrarCaptacoes, filtrarPorCriterios } from "@/lib/filter";
import { ordenarCaptacoes } from "@/lib/sort";
import { STATUSES, type Captacao, type Decisao, type Status } from "@/types";

export function KanbanBoard({ initial, userEmail }: { initial: Captacao[]; userEmail: string }) {
  const { byStatus, filtro, criterios, ordenacao, setCards, upsert, remove, applyMove, find, setConexao, beginSave, endSave } =
    useBoard();
  const [activeId, setActiveId] = useState<string | null>(null);
  const desktop = useIsDesktop();

  useEffect(() => setCards(initial), [initial, setCards]);

  // Realtime: reflete no quadro o que outros usuários fizerem.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("board-captacoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "captacoes", table: "captacao" },
        (payload) => {
          const row = payload.new as Captacao;
          if (payload.eventType === "DELETE") {
            remove((payload.old as Captacao).id);
          } else if (row.excluido_em) {
            remove(row.id);
          } else {
            upsert(row);
          }
        }
      )
      .subscribe((status) => {
        // SUBSCRIBED = conectado; demais estados = sem tempo real.
        if (status === "SUBSCRIBED") setConexao("online");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConexao("offline");
        else setConexao("conectando");
      });
    return () => {
      supabase.removeChannel(canal);
    };
  }, [upsert, remove, setConexao]);

  // Rede do navegador: offline imediato cobre o caso sem internet.
  useEffect(() => {
    const aoMudar = () => setConexao(navigator.onLine ? "conectando" : "offline");
    window.addEventListener("online", aoMudar);
    window.addEventListener("offline", aoMudar);
    if (!navigator.onLine) setConexao("offline");
    return () => {
      window.removeEventListener("online", aoMudar);
      window.removeEventListener("offline", aoMudar);
    };
  }, [setConexao]);

  const visiveis = useCallback(
    (cards: Captacao[]) =>
      ordenarCaptacoes(filtrarPorCriterios(filtrarCaptacoes(cards, filtro), criterios), ordenacao),
    [filtro, criterios, ordenacao]
  );

  // Núcleo da movimentação: otimista + RPC + rollback. Reusado por DnD e mobile.
  const persistMove = useCallback(
    async (card: Captacao, toStatus: Status, ordem: number, decisao: Decisao | null = null) => {
      const prevStatus = card.status;
      const prevOrdem = card.ordem;
      const prevDecisao = card.decisao;
      applyMove(card.id, toStatus, ordem, decisao ?? undefined);

      beginSave();
      const supabase = createClient();
      const { error } = await supabase.rpc("mover_cartao", {
        p_captacao_id: card.id,
        p_para_status: toStatus,
        p_ordem: ordem,
        p_decisao: decisao,
      });
      endSave(!error);
      if (error) {
        applyMove(card.id, prevStatus, prevOrdem, decisao ? prevDecisao : undefined);
        toast.error("Não foi possível mover o cartão.");
      }
    },
    [applyMove, beginSave, endSave]
  );

  // Mobile: aprovar/reprovar direto no card (mesma regra do DecisaoBox).
  const decidir = useCallback(
    (card: Captacao, decisao: Decisao) => {
      const destino: Status = decisao === "aprovada" ? "pendente_agendar_visita" : "pendente_negativa";
      const col = byStatus[destino];
      const ordem = orderBetween(col[col.length - 1]?.ordem ?? null, null);
      persistMove(card, destino, ordem, decisao);
      toast.success(decisao === "aprovada" ? "Captação aprovada." : "Captação reprovada.");
    },
    [byStatus, persistMove]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const card = find(String(active.id));
    if (!card) return;

    const overData = over.data.current as { status?: Status; card?: Captacao } | undefined;
    const toStatus: Status =
      overData?.status ?? overData?.card?.status ?? (STATUSES.includes(over.id as Status) ? (over.id as Status) : card.status);

    const column = byStatus[toStatus].filter((c) => c.id !== card.id);
    const overIndex = overData?.card ? column.findIndex((c) => c.id === overData.card!.id) : column.length;
    const before = overIndex > 0 ? column[overIndex - 1]?.ordem ?? null : null;
    const after = column[overIndex]?.ordem ?? null;
    const ordem = orderBetween(before, after);

    if (toStatus === card.status && card.ordem === ordem) return;
    persistMove(card, toStatus, ordem);
  }

  const totalCards = STATUSES.reduce((n, s) => n + byStatus[s].length, 0);
  const totalVisivel = STATUSES.reduce((n, s) => n + visiveis(byStatus[s]).length, 0);
  const semResultado = totalCards > 0 && totalVisivel === 0;

  // Primeiro uso: nenhuma captação cadastrada (idêntico em desktop e mobile).
  if (totalCards === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Inbox className="h-7 w-7" />
        </div>
        <div>
          <p className="font-medium">Nenhuma captação ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a primeira captação para começar a acompanhar o fluxo.
          </p>
        </div>
        <NovaCaptacaoButton />
      </div>
    );
  }

  // Antes de medir a largura: placeholder neutro (evita flash do board errado).
  if (desktop === null) return <div className="h-full" />;

  if (!desktop) {
    return <MobileBoard byStatus={byStatus} visiveis={visiveis} onDecidir={decidir} userEmail={userEmail} />;
  }

  if (semResultado) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {filtro.trim() ? `Nenhuma captação encontrada para “${filtro}”.` : "Nenhuma captação corresponde aos filtros."}
      </div>
    );
  }

  const active = activeId ? find(activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto px-4 pb-4">
        {STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} cards={visiveis(byStatus[status])} />
        ))}
      </div>
      <DragOverlay>{active ? <CaptacaoCard card={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
