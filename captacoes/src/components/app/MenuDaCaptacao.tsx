"use client";

import { useMemo, useState } from "react";
import { Check, MoreVertical, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/stores/app";
import { alternarLista } from "@/lib/listas-api";
import { ordemFimDaColuna } from "@/lib/decisao";
import { corDaLista, separarListas } from "@/lib/listas";
import { engavetadaSemDecisao } from "@/lib/etapa";
import { cn } from "@/lib/utils";
import type { Captacao } from "@/types";
import { ListaDialog } from "./ListaDialog";

/**
 * Menu do cartão: trocar as listas da captação e, quando ela está parada numa
 * gaveta antiga, devolvê-la à fila de decisão.
 *
 * A segunda ação existe porque lista e etapa são coisas diferentes: tirar a
 * etiqueta "Seleção Especial" não muda o `status` legado `selecao_especial`,
 * que é o que mantém o cartão na seção "Engavetadas — reavaliar". Sem uma
 * ação explícita, mexer nas listas parecia não fazer efeito nenhum.
 */
export function MenuDaCaptacao({ captacao }: { captacao: Captacao }) {
  const { listas, vinculos, patch, beginSave, endSave } = useApp();
  const [aberto, setAberto] = useState(false);
  const [novaLista, setNovaLista] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const dentro = useMemo(
    () => new Set(vinculos.filter((v) => v.captacao_id === captacao.id).map((v) => v.lista_id)),
    [vinculos, captacao.id]
  );

  const todas = useMemo(() => {
    const { fixas, migracao } = separarListas(listas);
    return [...fixas, ...migracao];
  }, [listas]);

  const engavetada = engavetadaSemDecisao(captacao);

  async function alternar(listaId: string) {
    const estava = dentro.has(listaId);
    const ok = await alternarLista(captacao.id, listaId, !estava);
    if (!ok) toast.error(estava ? "Não foi possível tirar da lista." : "Não foi possível adicionar à lista.");
  }

  /** Devolve à fila de decisão preservando as listas (a etiqueta é organização). */
  async function voltarParaFila() {
    setOcupado(true);
    beginSave();
    const ordem = await ordemFimDaColuna("em_decisao");
    const supabase = createClient();
    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: "em_decisao",
      p_ordem: ordem,
      p_decisao: null,
    });
    setOcupado(false);
    endSave(!error);
    if (error) return toast.error("Não foi possível voltar a captação para a fila.");

    patch(captacao.id, { status: "em_decisao", ordem });
    setAberto(false);
    toast.success("De volta à fila de decisão. As listas foram mantidas.");
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        aria-label="Opções da captação"
        aria-expanded={aberto}
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAberto(false);
            }}
          />
          <div
            className="absolute right-0 top-8 z-40 w-60 overflow-hidden rounded-xl border bg-card shadow-lg"
            onClick={(e) => e.preventDefault()}
          >
            <p className="px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Listas
            </p>

            <div className="max-h-56 overflow-y-auto px-1">
              {todas.length === 0 && (
                <p className="px-2 pb-2 text-[12.5px] text-muted-foreground">Nenhuma lista ainda.</p>
              )}
              {todas.map((l) => {
                const cor = corDaLista(l);
                const on = dentro.has(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => alternar(l.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-muted",
                      on && "font-semibold"
                    )}
                  >
                    <span className="h-2 w-2 flex-none rounded-full" style={{ background: cor.dot }} />
                    <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                    {on && <Check className="h-4 w-4 flex-none text-secondary" strokeWidth={2.4} />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setAberto(false);
                setNovaLista(true);
              }}
              className="flex w-full items-center gap-2.5 border-t px-3 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              Nova lista
            </button>

            {engavetada && (
              <button
                type="button"
                onClick={voltarParaFila}
                disabled={ocupado}
                className="flex w-full items-start gap-2.5 border-t px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60"
              >
                <Undo2 className="mt-0.5 h-4 w-4 flex-none text-secondary" strokeWidth={2.2} />
                <span>
                  <span className="block text-[13px] font-semibold text-foreground">
                    Voltar para a fila de decisão
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    Sai de &ldquo;Engavetadas&rdquo;. As listas continuam.
                  </span>
                </span>
              </button>
            )}
          </div>
        </>
      )}

      <ListaDialog
        open={novaLista}
        onOpenChange={setNovaLista}
        onCriada={(l) => alternarLista(captacao.id, l.id, true)}
      />
    </>
  );
}
