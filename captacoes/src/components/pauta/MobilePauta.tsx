"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AdicionarItem } from "./AdicionarItem";
import { PautaDialog, type PautaDados } from "./PautaDialog";
import { usePauta } from "@/stores/pauta";
import { usePautaAcoes } from "@/lib/usePautaAcoes";
import { cn } from "@/lib/utils";
import { dataCurta } from "@/lib/format";
import { diasAteData, ordemAoMover, progresso, rotuloData } from "@/lib/pauta";
import type { Pauta, PautaItem } from "@/types";

/**
 * A raia de pauta no quadro mobile. Sem arrastar: no toque, dentro de uma
 * lista que já rola, setas ↑/↓ acertam mais do que drag-and-drop.
 */
export function MobilePauta() {
  const pautas = usePauta((s) => s.pautas);
  const acoes = usePautaAcoes();
  const [criando, setCriando] = useState(false);

  return (
    <div className="space-y-[14px]">
      {pautas.map((p) => (
        <PautaMobileCard key={p.id} pauta={p} />
      ))}

      {pautas.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-sm text-[#9a9c90]">
          <Clapperboard className="h-8 w-8" />
          <p className="font-medium text-[#5f6157]">Nenhuma pauta ainda</p>
          <p className="max-w-[16rem] text-xs">
            Monte a sequência do que vai ser gravado — imóveis do quadro ou recados soltos.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCriando(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-[#d5d7cd] py-3 text-sm font-medium text-[#6e7063] active:bg-[#e9eae4]"
      >
        <Plus className="h-4 w-4" /> Nova pauta
      </button>

      <PautaDialog
        open={criando}
        onSalvar={(dados: PautaDados) => acoes.criar(dados)}
        onOpenChange={setCriando}
      />
    </div>
  );
}

function PautaMobileCard({ pauta }: { pauta: Pauta }) {
  const itens = usePauta((s) => s.itens[pauta.id]) ?? [];
  const acoes = usePautaAcoes();
  const [editando, setEditando] = useState(false);

  const { feitos, total } = progresso(itens);
  const dias = pauta.data_alvo ? diasAteData(pauta.data_alvo) : null;

  function mover(item: PautaItem, index: number, delta: 1 | -1) {
    const ordem = ordemAoMover(itens, index, delta);
    if (ordem == null) return;
    acoes.reordenarItem(item, pauta.id, ordem);
  }

  return (
    <Card
      className={cn(
        "space-y-3 rounded-[18px] border-[#e8e9e3] p-[17px] shadow-[0_1px_2px_rgba(46,48,42,0.04),0_10px_24px_-16px_rgba(46,48,42,0.22)]",
        pauta.concluida && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium leading-snug", pauta.concluida && "line-through")}>
            {pauta.titulo}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {pauta.data_alvo && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold",
                  dias != null && dias < 0
                    ? "bg-[#f0e2e2] text-[#7a3434]"
                    : dias === 0
                      ? "bg-[#f7ecd9] text-[#8f6320]"
                      : "bg-[#ebece7] text-[#5f6157]"
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {dataCurta(`${pauta.data_alvo}T00:00:00`)} · {rotuloData(pauta.data_alvo)}
              </span>
            )}
            {total > 0 && (
              <span className="rounded-lg bg-[#ebece7] px-2 py-1 font-semibold tabular-nums text-[#5f6157]">
                {feitos}/{total} gravados
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <TouchBtn
            titulo={pauta.concluida ? "Reabrir" : "Concluir"}
            onClick={() => acoes.concluir(pauta, !pauta.concluida)}
          >
            {pauta.concluida ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          </TouchBtn>
          <TouchBtn titulo="Editar" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" />
          </TouchBtn>
          <TouchBtn titulo="Excluir" onClick={() => acoes.excluir(pauta)}>
            <Trash2 className="h-4 w-4" />
          </TouchBtn>
        </div>
      </div>

      {pauta.descricao && (
        <p className="whitespace-pre-line text-xs text-[#6e7063]">{pauta.descricao}</p>
      )}

      <ul className="space-y-1">
        {itens.map((item, i) => (
          <li key={item.id} className="flex items-start gap-2 rounded-lg bg-[#f5f6f1] px-2 py-2">
            <Checkbox
              checked={item.concluido}
              onCheckedChange={(v) => acoes.alterarItem(item, { concluido: v === true })}
              aria-label={`Marcar "${item.texto}" como gravado`}
              className="mt-[3px]"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-snug">
                <span className="mr-1 font-semibold tabular-nums text-[#9a9c90]">{i + 1}.</span>
                <span className={cn(item.concluido && "text-[#9a9c90] line-through")}>{item.texto}</span>
              </p>
              {item.captacao_id && (
                <Link
                  href={`/captacao/${item.captacao_id}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#857727]"
                >
                  <Link2 className="h-3 w-3" /> abrir captação
                </Link>
              )}
            </div>
            <div className="flex shrink-0 flex-col">
              <TouchBtn titulo="Subir" compacto disabled={i === 0} onClick={() => mover(item, i, -1)}>
                <ChevronUp className="h-4 w-4" />
              </TouchBtn>
              <TouchBtn
                titulo="Descer"
                compacto
                disabled={i === itens.length - 1}
                onClick={() => mover(item, i, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </TouchBtn>
            </div>
            <TouchBtn titulo="Remover" compacto onClick={() => acoes.excluirItem(item)}>
              <X className="h-4 w-4" />
            </TouchBtn>
          </li>
        ))}
      </ul>

      <AdicionarItem
        onAdicionar={(texto, captacaoId) => acoes.adicionarItem(pauta.id, texto, captacaoId)}
      />

      <PautaDialog
        open={editando}
        pauta={pauta}
        onSalvar={(dados: PautaDados) => acoes.editar(pauta, dados)}
        onOpenChange={setEditando}
      />
    </Card>
  );
}

function TouchBtn({
  titulo,
  onClick,
  children,
  compacto = false,
  disabled = false,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
  compacto?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg text-[#6e7063] transition-colors active:bg-[#e2e3dd] disabled:opacity-25",
        compacto ? "p-0.5" : "p-1.5"
      )}
    >
      {children}
    </button>
  );
}
