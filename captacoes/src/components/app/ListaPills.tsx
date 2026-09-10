"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useApp } from "@/stores/app";
import { contarPorLista, corDaLista, pillsDaBarra } from "@/lib/listas";
import { cn, CONTAINER } from "@/lib/utils";
import type { Captacao, Lista } from "@/types";
import { ListaDialog } from "./ListaDialog";

/**
 * Barra de listas — o substituto das colunas do Kanban. Pills roláveis com
 * ponto colorido, nome e contagem; a ativa filtra a tela inteira.
 *
 * Só as listas HERDADAS da virada (com o nome da coluna antiga) e sem
 * captação aqui ficam atrás de "ver todas", para não empurrarem Prioridade e
 * Gaveta para fora da tela. Lista que alguém criou aparece sempre — ver
 * `pillsDaBarra`.
 *
 * A barra vive na aba Aprovadas, mas etiquetar também acontece em Decidir:
 * por isso a pill traz duas contagens, quantas a lista tem AQUI e quantas
 * ainda estão fora.
 */
export function ListaPills({ visiveis }: { visiveis: Captacao[] }) {
  const { cards, listas, vinculos, listaAtiva, setListaAtiva } = useApp();
  const [novaAberta, setNovaAberta] = useState(false);
  const [editando, setEditando] = useState<Lista | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const contagem = useMemo(
    () =>
      contarPorLista(
        vinculos,
        new Set(visiveis.map((c) => c.id)),
        new Set(cards.map((c) => c.id))
      ),
    [vinculos, visiveis, cards]
  );

  const { mostradas, ocultas } = useMemo(
    () => pillsDaBarra(listas, contagem, listaAtiva, verTodas),
    [listas, contagem, listaAtiva, verTodas]
  );

  return (
    <>
      <div className="flex-none border-b bg-background py-3">
        {/* `scroll-px` reserva a mesma folga das laterais quando a pill ativa
            é trazida para a área visível — sem isso ela encosta na borda. */}
        <div className={cn(CONTAINER, "no-scrollbar flex items-center gap-1.5 overflow-x-auto scroll-px-[18px] px-[18px] lg:px-6")}>
          <Pill ativa={listaAtiva === null} onClick={() => setListaAtiva(null)} nome="Todas" contagem={visiveis.length} />

          {mostradas.map((l) => {
            const cor = corDaLista(l);
            const ativa = listaAtiva === l.id;
            const n = contagem.get(l.id);
            return (
              <Pill
                key={l.id}
                ativa={ativa}
                nome={l.nome}
                contagem={n?.aqui ?? 0}
                fora={n?.fora ?? 0}
                dot={cor.dot}
                onClick={() => setListaAtiva(ativa ? null : l.id)}
                onEditar={() => setEditando(l)}
              />
            );
          })}

          {ocultas > 0 && (
            <button
              type="button"
              onClick={() => setVerTodas(true)}
              className="h-[34px] flex-none rounded-[11px] border border-dashed px-3 text-[13px] font-semibold text-muted-foreground"
            >
              + {ocultas} {ocultas === 1 ? "lista" : "listas"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setNovaAberta(true)}
            className="flex h-[34px] flex-none items-center gap-1.5 whitespace-nowrap rounded-[11px] border border-dashed px-3 text-[13px] font-semibold text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova lista
          </button>
        </div>
      </div>

      <ListaDialog
        open={novaAberta}
        onOpenChange={setNovaAberta}
        onCriada={(l) => setListaAtiva(l.id)}
      />
      <ListaDialog
        open={editando !== null}
        onOpenChange={(v) => !v && setEditando(null)}
        lista={editando ?? undefined}
      />
    </>
  );
}

function Pill({
  ativa,
  nome,
  contagem,
  fora = 0,
  dot,
  onClick,
  onEditar,
}: {
  ativa: boolean;
  nome: string;
  contagem: number;
  /** Captações da lista que ainda não chegaram em Aprovadas. */
  fora?: number;
  dot?: string;
  onClick: () => void;
  onEditar?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  // Ao ficar ativa a pill cresce (ganha o botão de editar) e pode passar da
  // borda da barra rolável — quem clicou na ponta direita via a própria pill
  // cortada. Traz de volta o pedaço que ficou de fora.
  useEffect(() => {
    if (ativa) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [ativa]);

  return (
    <span ref={ref} className="flex flex-none items-center">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ativa}
        className={cn(
          "flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[11px] border px-3 text-[13px] font-semibold",
          ativa ? "border-secondary bg-secondary text-secondary-foreground" : "border-input bg-card text-foreground",
          ativa && onEditar && "rounded-r-none pr-2"
        )}
      >
        {dot && (
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: ativa ? "currentColor" : dot }}
          />
        )}
        {nome}
        <span className="text-xs opacity-60">{contagem}</span>
        {/* Uma lista pode ser montada lá em Decidir, pelo menu ⋯ do cartão.
            Sem este segundo número, ela aparecia aqui como um "0" seco e
            parecia que as etiquetas não tinham pegado. */}
        {fora > 0 && (
          <span
            className="text-xs opacity-45"
            title={`${fora} ${fora === 1 ? "captação ainda não está" : "captações ainda não estão"} em Aprovadas`}
          >
            +{fora}
          </span>
        )}
      </button>
      {ativa && onEditar && (
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar lista ${nome}`}
          className="flex h-[34px] items-center rounded-r-[11px] border border-l-0 border-secondary bg-secondary pl-1 pr-2.5 text-secondary-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
