"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useApp } from "@/stores/app";
import { corDaLista, separarListas } from "@/lib/listas";
import { cn } from "@/lib/utils";
import type { Captacao, Lista } from "@/types";
import { ListaDialog } from "./ListaDialog";

/**
 * Barra de listas — o substituto das colunas do Kanban. Pills roláveis com
 * ponto colorido, nome e contagem; a ativa filtra a tela inteira.
 *
 * As listas de migração (criadas na virada, com o nome da coluna antiga)
 * ficam atrás de "ver todas" para não empurrar Prioridade e Gaveta para fora
 * da tela no primeiro dia.
 */
export function ListaPills({ visiveis }: { visiveis: Captacao[] }) {
  const { listas, vinculos, listaAtiva, setListaAtiva } = useApp();
  const [novaAberta, setNovaAberta] = useState(false);
  const [editando, setEditando] = useState<Lista | null>(null);
  const [verTodas, setVerTodas] = useState(false);

  const contagem = useMemo(() => {
    const idsVisiveis = new Set(visiveis.map((c) => c.id));
    const out = new Map<string, number>();
    for (const v of vinculos) {
      if (!idsVisiveis.has(v.captacao_id)) continue;
      out.set(v.lista_id, (out.get(v.lista_id) ?? 0) + 1);
    }
    return out;
  }, [vinculos, visiveis]);

  const { fixas, migracao } = useMemo(() => separarListas(listas), [listas]);
  // Lista de migração vazia não merece espaço na barra.
  const extras = migracao.filter((l) => (contagem.get(l.id) ?? 0) > 0);
  const mostradas = verTodas ? [...fixas, ...extras] : fixas;

  return (
    <>
      <div className="flex-none border-b bg-background py-3">
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-[18px]">
          <Pill ativa={listaAtiva === null} onClick={() => setListaAtiva(null)} nome="Todas" contagem={visiveis.length} />

          {mostradas.map((l) => {
            const cor = corDaLista(l);
            const ativa = listaAtiva === l.id;
            return (
              <Pill
                key={l.id}
                ativa={ativa}
                nome={l.nome}
                contagem={contagem.get(l.id) ?? 0}
                dot={cor.dot}
                onClick={() => setListaAtiva(ativa ? null : l.id)}
                onEditar={() => setEditando(l)}
              />
            );
          })}

          {!verTodas && extras.length > 0 && (
            <button
              type="button"
              onClick={() => setVerTodas(true)}
              className="h-[34px] flex-none rounded-[11px] border border-dashed px-3 text-[13px] font-semibold text-muted-foreground"
            >
              + {extras.length} {extras.length === 1 ? "lista" : "listas"}
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
  dot,
  onClick,
  onEditar,
}: {
  ativa: boolean;
  nome: string;
  contagem: number;
  dot?: string;
  onClick: () => void;
  onEditar?: () => void;
}) {
  return (
    <span className="flex flex-none items-center">
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
