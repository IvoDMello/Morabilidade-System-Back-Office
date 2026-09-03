"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { usePauta } from "@/stores/pauta";
import { useBoard } from "@/stores/board";
import { ordemNoFim } from "@/lib/pauta";
import {
  atualizarItem,
  atualizarPauta,
  criarItem,
  criarPauta,
  excluirItem as excluirItemDb,
  excluirPauta as excluirPautaDb,
} from "@/lib/pauta-api";
import type { Pauta, PautaItem } from "@/types";
import type { PautaDados } from "@/components/pauta/PautaDialog";

/**
 * Ações da raia de pauta com atualização otimista e rollback.
 *
 * Lê os stores por `getState()` em vez de assinar: o objeto devolvido é
 * estável e nenhum cartão de pauta re-renderiza porque uma captação se mexeu
 * do outro lado do quadro. Como bônus, cada ação enxerga o estado do momento
 * do clique, não o da renderização.
 *
 * Criar espera o servidor (precisa do id gerado lá e não é interação de
 * arrasto, latência não incomoda). Alternar, renomear e mover aplicam na hora
 * e desfazem se a gravação falhar. O contador de "salvando" é o mesmo do
 * quadro, então o indicador de sincronia da topbar cobre a pauta também.
 */
export function usePautaAcoes() {
  return useMemo(() => {
    async function comSalvamento<T>(fn: () => Promise<T>): Promise<T> {
      const { beginSave, endSave } = useBoard.getState();
      beginSave();
      const r = await fn();
      endSave(!!r);
      return r;
    }

    return {
      async criar(dados: PautaDados) {
        const { pautas, upsertPauta } = usePauta.getState();
        const nova = await comSalvamento(() => criarPauta(dados, ordemNoFim(pautas)));
        if (!nova) {
          toast.error("Não foi possível criar a pauta.");
          return null;
        }
        upsertPauta(nova);
        return nova;
      },

      async editar(pauta: Pauta, dados: PautaDados) {
        const { upsertPauta } = usePauta.getState();
        upsertPauta({ ...pauta, ...dados });
        if (!(await comSalvamento(() => atualizarPauta(pauta.id, dados)))) {
          upsertPauta(pauta);
          toast.error("Não foi possível salvar a pauta.");
        }
      },

      async excluir(pauta: Pauta) {
        const { itens, removePauta, upsertPauta, upsertItem } = usePauta.getState();
        const itensDela = itens[pauta.id] ?? [];
        removePauta(pauta.id);
        if (!(await comSalvamento(() => excluirPautaDb(pauta.id)))) {
          upsertPauta(pauta);
          for (const i of itensDela) upsertItem(i);
          toast.error("Não foi possível excluir a pauta.");
          return;
        }
        toast.success("Pauta excluída.", {
          action: {
            label: "Desfazer",
            onClick: async () => {
              upsertPauta(pauta);
              for (const i of itensDela) upsertItem(i);
              if (!(await atualizarPauta(pauta.id, { excluido_em: null }))) {
                removePauta(pauta.id);
                toast.error("Não foi possível restaurar a pauta.");
              }
            },
          },
        });
      },

      async concluir(pauta: Pauta, concluida: boolean) {
        const { upsertPauta } = usePauta.getState();
        upsertPauta({ ...pauta, concluida });
        if (!(await comSalvamento(() => atualizarPauta(pauta.id, { concluida })))) {
          upsertPauta(pauta);
          toast.error("Não foi possível atualizar a pauta.");
        }
      },

      async reordenar(pauta: Pauta, ordem: number) {
        const { moverPauta } = usePauta.getState();
        moverPauta(pauta.id, ordem);
        if (!(await comSalvamento(() => atualizarPauta(pauta.id, { ordem })))) {
          moverPauta(pauta.id, pauta.ordem);
          toast.error("Não foi possível reordenar a pauta.");
        }
      },

      async adicionarItem(pautaId: string, texto: string, captacaoId: string | null) {
        const { itens, upsertItem } = usePauta.getState();
        const novo = await comSalvamento(() =>
          criarItem(
            { pauta_id: pautaId, texto, captacao_id: captacaoId },
            ordemNoFim(itens[pautaId] ?? [])
          )
        );
        if (!novo) {
          toast.error("Não foi possível adicionar o item.");
          return null;
        }
        upsertItem(novo);
        return novo;
      },

      async alterarItem(item: PautaItem, patch: Partial<PautaItem>) {
        const { upsertItem } = usePauta.getState();
        upsertItem({ ...item, ...patch });
        if (!(await comSalvamento(() => atualizarItem(item.id, patch)))) {
          upsertItem(item);
          toast.error("Não foi possível salvar o item.");
        }
      },

      async excluirItem(item: PautaItem) {
        const { removeItem, upsertItem } = usePauta.getState();
        removeItem(item.id, item.pauta_id);
        if (!(await comSalvamento(() => excluirItemDb(item.id)))) {
          upsertItem(item);
          toast.error("Não foi possível remover o item.");
        }
      },

      async reordenarItem(item: PautaItem, paraPauta: string, ordem: number) {
        const { moverItem } = usePauta.getState();
        moverItem(item.id, paraPauta, ordem);
        if (!(await comSalvamento(() => atualizarItem(item.id, { pauta_id: paraPauta, ordem })))) {
          moverItem(item.id, item.pauta_id, item.ordem);
          toast.error("Não foi possível mover o item.");
        }
      },
    };
  }, []);
}
