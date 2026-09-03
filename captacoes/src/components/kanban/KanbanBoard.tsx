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
import { GavetaDialog } from "./GavetaDialog";
import { CaptacaoCard } from "./CaptacaoCard";
import { MobileBoard } from "./MobileBoard";
import { NovaCaptacaoButton } from "@/components/captacao/NovaCaptacaoButton";
import { PautaLane, PAUTA_LANE_ID } from "@/components/pauta/PautaLane";
import { PautaCardPreview } from "@/components/pauta/PautaCard";
import { PautaItemPreview } from "@/components/pauta/PautaItemRow";
import { useBoard } from "@/stores/board";
import { usePauta } from "@/stores/pauta";
import { usePautaAcoes } from "@/lib/usePautaAcoes";
import { ordemNaPosicao, textoDaCaptacao } from "@/lib/pauta";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import { filtrarCaptacoes, filtrarPorCriterios } from "@/lib/filter";
import { fetchOpinioesResumo } from "@/lib/opinioes";
import { confirmarDecisao, destinoDecisao } from "@/lib/decisao";
import { ordenarCaptacoes, priorizarRevisaoGaveta } from "@/lib/sort";
import {
  STATUSES,
  BOARD_STATUSES,
  STATUS_LABEL,
  type Captacao,
  type Decisao,
  type Pauta,
  type PautaItem,
  type Status,
} from "@/types";

/** `data` que cada elemento arrastável/soltável do quadro publica no dnd-kit. */
interface DragData {
  tipo?: "captacao" | "pauta" | "pauta-item" | "pauta-drop" | "pauta-lane";
  status?: Status;
  card?: Captacao;
  pauta?: Pauta;
  item?: PautaItem;
  pautaId?: string;
}

/**
 * Em qual pauta o ponteiro soltou. O alvo pode ser o corpo do cartão
 * ("pauta-drop"), o cabeçalho dele ("pauta") ou um item já existente.
 * Devolve null quando a soltura não foi sobre nenhuma pauta.
 *
 * O `data` do dnd-kit é uma foto do último render; para o item vamos ao store
 * saber em que pauta ele está agora (alguém pode tê-lo movido no meio do
 * arrasto, via realtime).
 */
function pautaDoAlvo(over: DragData): string | null {
  if (over.tipo === "pauta-drop") return over.pautaId ?? null;
  if (over.tipo === "pauta") return over.pauta?.id ?? null;
  if (over.tipo === "pauta-item" && over.item) {
    return usePauta.getState().acharItem(over.item.id)?.pauta_id ?? null;
  }
  return null;
}

export function KanbanBoard({
  initial,
  pautasIniciais,
  itensIniciais,
  userEmail,
  userNome,
}: {
  initial: Captacao[];
  pautasIniciais: Pauta[];
  itensIniciais: PautaItem[];
  userEmail: string;
  userNome: string;
}) {
  const { byStatus, filtro, criterios, ordenacao, setCards, upsert, remove, applyMove, find, setConexao, beginSave, endSave, setOpinioes } =
    useBoard();
  // Só `pautas` é assinado: a lista de itens muda a cada checkbox marcado e
  // assinar ela aqui re-renderizaria o quadro inteiro. Onde os itens são
  // necessários (arrasto e miniatura do overlay) lemos o estado do momento.
  const pautas = usePauta((s) => s.pautas);
  const setTudo = usePauta((s) => s.setTudo);
  const upsertPauta = usePauta((s) => s.upsertPauta);
  const removePauta = usePauta((s) => s.removePauta);
  const upsertItem = usePauta((s) => s.upsertItem);
  const removeItem = usePauta((s) => s.removeItem);
  const acoesPauta = usePautaAcoes();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Cartão recém-engavetado aguardando motivo/data de revisão.
  const [gavetaCard, setGavetaCard] = useState<Captacao | null>(null);
  const desktop = useIsDesktop();

  useEffect(() => setCards(initial), [initial, setCards]);
  useEffect(
    () => setTudo(pautasIniciais, itensIniciais),
    [pautasIniciais, itensIniciais, setTudo]
  );

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
          } else if (row.excluido_em || row.status === "publicada") {
            // Excluída ou publicada: sai das colunas ativas do quadro.
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

  // Opiniões: contadores no mount, quando o app volta ao foco e a cada
  // opinião nova publicada via realtime.
  useEffect(() => {
    let ativo = true;
    const carregar = () => fetchOpinioesResumo().then((o) => ativo && setOpinioes(o));
    carregar();
    const aoFocar = () => {
      if (document.visibilityState === "visible") carregar();
    };
    document.addEventListener("visibilitychange", aoFocar);

    const supabase = createClient();
    const canal = supabase
      .channel("board-opinioes")
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "opiniao" }, carregar)
      .subscribe();

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoFocar);
      supabase.removeChannel(canal);
    };
  }, [setOpinioes]);

  // Realtime da pauta: a agenda de gravação é montada a quatro mãos.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("board-pauta")
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "pauta" }, (payload) => {
        if (payload.eventType === "DELETE") return removePauta((payload.old as Pauta).id);
        const row = payload.new as Pauta;
        // Soft-delete chega como UPDATE: sai da raia igual à captação.
        if (row.excluido_em) removePauta(row.id);
        else upsertPauta(row);
      })
      .on("postgres_changes", { event: "*", schema: "captacoes", table: "pauta_item" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const antigo = payload.old as PautaItem;
          return removeItem(antigo.id, antigo.pauta_id);
        }
        upsertItem(payload.new as PautaItem);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [upsertPauta, removePauta, upsertItem, removeItem]);

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
      priorizarRevisaoGaveta(
        ordenarCaptacoes(filtrarPorCriterios(filtrarCaptacoes(cards, filtro), criterios), ordenacao)
      ),
    [filtro, criterios, ordenacao]
  );

  // Núcleo da movimentação: otimista + RPC + rollback. Reusado por DnD e mobile.
  const persistMove = useCallback(
    async (
      card: Captacao,
      toStatus: Status,
      ordem: number,
      decisao: Decisao | null = null,
      isUndo = false
    ) => {
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
        return;
      }
      if (toStatus === "gaveta" && prevStatus !== "gaveta") {
        // Engavetou: pede motivo e data de reavaliação (opcionais).
        setGavetaCard(card);
      }
      // Desfazer só para movimentações simples: decisões têm o próprio
      // caminho de reversão ("Mudou de ideia?") no detalhe.
      if (!isUndo && !decisao && toStatus !== prevStatus) {
        toast.success(`Movida para "${STATUS_LABEL[toStatus]}".`, {
          action: {
            label: "Desfazer",
            onClick: () => {
              setGavetaCard(null);
              persistMove({ ...card, status: toStatus, ordem }, prevStatus, prevOrdem, null, true);
            },
          },
        });
      }
    },
    [applyMove, beginSave, endSave]
  );

  // Mobile: aprovar/reprovar direto no card (mesma regra do DecisaoBox).
  const decidir = useCallback(
    (card: Captacao, decisao: Decisao) => {
      if (!confirmarDecisao(card, decisao)) return;
      const destino: Status = destinoDecisao(decisao);
      const col = byStatus[destino];
      const ordem = orderBetween(col[col.length - 1]?.ordem ?? null, null);
      persistMove(card, destino, ordem, decisao);
      toast.success(decisao === "aprovada" ? "Captação aprovada." : "Captação reprovada.");
    },
    [byStatus, persistMove]
  );

  // Mobile: marcar como publicada direto no card (estado terminal → aba Publicadas).
  const publicar = useCallback(
    (card: Captacao) => {
      // Ordem na coluna oculta é irrelevante; a lista ordena por data.
      persistMove(card, "publicada", Date.now());
    },
    [persistMove]
  );

  // Mobile: mover o cartão para outra etapa (vai pro fim da coluna destino).
  const mover = useCallback(
    (card: Captacao, toStatus: Status) => {
      if (toStatus === card.status) return;
      const col = byStatus[toStatus];
      const ordem = orderBetween(col[col.length - 1]?.ordem ?? null, null);
      persistMove(card, toStatus, ordem);
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

    const activeData = (active.data.current ?? {}) as DragData;
    const overData = (over.data.current ?? {}) as DragData;
    const overId = String(over.id);
    const naRaia = overId === PAUTA_LANE_ID || !!pautaDoAlvo(overData);

    // --- cartão de pauta: só reordena dentro da própria raia ---
    if (activeData.tipo === "pauta") {
      // Do store, não do `data` do dnd-kit: a ordem pode ter mudado no meio.
      const pauta = pautas.find((p) => p.id === String(active.id));
      if (!pauta || !naRaia) return;
      const lista = pautas.filter((p) => p.id !== pauta.id);
      const alvo = overData.tipo === "pauta" ? overData.pauta?.id : undefined;
      const i = alvo ? lista.findIndex((p) => p.id === alvo) : -1;
      const ordem = ordemNaPosicao(lista, i < 0 ? lista.length : i);
      if (ordem !== pauta.ordem) acoesPauta.reordenar(pauta, ordem);
      return;
    }

    // --- item da pauta: reordena na mesma pauta ou muda de pauta ---
    if (activeData.tipo === "pauta-item") {
      const { itens, acharItem } = usePauta.getState();
      const item = acharItem(String(active.id));
      if (!item) return;
      const destino = pautaDoAlvo(overData) ?? (overId === PAUTA_LANE_ID ? item.pauta_id : null);
      if (!destino) return;
      const lista = (itens[destino] ?? []).filter((i) => i.id !== item.id);
      const alvo = overData.tipo === "pauta-item" ? overData.item?.id : undefined;
      const i = alvo ? lista.findIndex((x) => x.id === alvo) : -1;
      const ordem = ordemNaPosicao(lista, i < 0 ? lista.length : i);
      if (destino === item.pauta_id && ordem === item.ordem) return;
      acoesPauta.reordenarItem(item, destino, ordem);
      return;
    }

    const card = find(String(active.id));
    if (!card) return;

    // --- captação solta na pauta: vira linha da agenda e CONTINUA na coluna ---
    if (naRaia) {
      const { itens } = usePauta.getState();
      const destino = pautaDoAlvo(overData);
      if (!destino) {
        toast.info("Solte a captação sobre uma pauta para entrar na sequência.");
        return;
      }
      if ((itens[destino] ?? []).some((i) => i.captacao_id === card.id)) {
        toast.info("Essa captação já está nessa pauta.");
        return;
      }
      const novo = await acoesPauta.adicionarItem(destino, textoDaCaptacao(card), card.id);
      if (novo) {
        toast.success("Adicionada à pauta de gravação.", {
          action: { label: "Desfazer", onClick: () => acoesPauta.excluirItem(novo) },
        });
      }
      return;
    }

    const toStatus: Status =
      overData.status ?? overData.card?.status ?? (STATUSES.includes(over.id as Status) ? (over.id as Status) : card.status);

    const column = byStatus[toStatus].filter((c) => c.id !== card.id);
    const overIndex = overData.card ? column.findIndex((c) => c.id === overData.card!.id) : column.length;
    const before = overIndex > 0 ? column[overIndex - 1]?.ordem ?? null : null;
    const after = column[overIndex]?.ordem ?? null;
    const ordem = orderBetween(before, after);

    if (toStatus === card.status && card.ordem === ordem) return;
    persistMove(card, toStatus, ordem);
  }

  const totalCards = BOARD_STATUSES.reduce((n, s) => n + byStatus[s].length, 0);
  const totalVisivel = BOARD_STATUSES.reduce((n, s) => n + visiveis(byStatus[s]).length, 0);
  const semResultado = totalCards > 0 && totalVisivel === 0;

  // Primeiro uso: nada no quadro ainda (idêntico em desktop e mobile). Com
  // pauta criada o quadro aparece normalmente, senão a raia ficaria inacessível.
  if (totalCards === 0 && pautas.length === 0) {
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
    return (
      <>
        <MobileBoard byStatus={byStatus} visiveis={visiveis} onDecidir={decidir} onMover={mover} onPublicar={publicar} userEmail={userEmail} userNome={userNome} />
        <GavetaDialog key={gavetaCard?.id ?? "none"} card={gavetaCard} onClose={() => setGavetaCard(null)} />
      </>
    );
  }

  const active = activeId ? find(activeId) : null;
  const pautaAtiva = activeId ? pautas.find((p) => p.id === activeId) : undefined;
  // Miniatura do arrasto: lida no início do gesto, não precisa ser reativa.
  const itemAtivo = activeId ? usePauta.getState().acharItem(activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {/* overscroll-x-contain: chegar ao fim das colunas não empurra a página
          nem dispara o "voltar" por gesto do navegador. */}
      <div className="flex h-full gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4">
        {semResultado ? (
          // Filtro sem resultado esvazia as colunas, mas a pauta continua à
          // mão: ela não é filtrada junto com as captações.
          <div className="flex min-w-[28rem] flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {filtro.trim()
              ? `Nenhuma captação encontrada para “${filtro}”.`
              : "Nenhuma captação corresponde aos filtros."}
          </div>
        ) : (
          BOARD_STATUSES.map((status) => (
            <KanbanColumn key={status} status={status} cards={visiveis(byStatus[status])} />
          ))
        )}
        <PautaLane />
      </div>
      <DragOverlay>
        {active ? (
          <CaptacaoCard card={active} overlay />
        ) : pautaAtiva ? (
          <PautaCardPreview pauta={pautaAtiva} itens={usePauta.getState().itensDe(pautaAtiva.id).length} />
        ) : itemAtivo ? (
          <PautaItemPreview item={itemAtivo} />
        ) : null}
      </DragOverlay>
      <GavetaDialog key={gavetaCard?.id ?? "none"} card={gavetaCard} onClose={() => setGavetaCard(null)} />
    </DndContext>
  );
}
