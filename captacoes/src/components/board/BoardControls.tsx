"use client";

import { useState } from "react";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/stores/board";
import { parseMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDENACAO_LABEL, type Criterios, type Ordenacao } from "@/types";

const ORDENACOES = Object.keys(ORDENACAO_LABEL) as Ordenacao[];

function contarAtivos(c: Criterios): number {
  let n = 0;
  if (c.valorMin != null) n++;
  if (c.valorMax != null) n++;
  if (c.quartosMin != null) n++;
  if (c.soParadas) n++;
  return n;
}

export function BoardControls() {
  const { ordenacao, setOrdenacao, criterios, setCriterios, limparCriterios } = useBoard();
  const ativos = contarAtivos(criterios);

  // Estado local do formulário, só aplica ao confirmar.
  const [open, setOpen] = useState(false);
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [quartosMin, setQuartosMin] = useState("");
  const [soParadas, setSoParadas] = useState(false);

  function abrir(v: boolean) {
    if (v) {
      setValorMin(criterios.valorMin?.toString() ?? "");
      setValorMax(criterios.valorMax?.toString() ?? "");
      setQuartosMin(criterios.quartosMin?.toString() ?? "");
      setSoParadas(criterios.soParadas);
    }
    setOpen(v);
  }

  function aplicar() {
    setCriterios({
      valorMin: parseMoeda(valorMin),
      valorMax: parseMoeda(valorMax),
      quartosMin: quartosMin.trim() ? Number(quartosMin) : null,
      soParadas,
    });
    setOpen(false);
  }

  function limpar() {
    limparCriterios();
    setValorMin("");
    setValorMax("");
    setQuartosMin("");
    setSoParadas(false);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Ordenação */}
      <div className="relative">
        <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          aria-label="Ordenar coluna"
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
          className="h-9 rounded-md border border-input bg-background pl-8 pr-2 text-xs font-medium text-foreground"
        >
          {ORDENACOES.map((o) => (
            <option key={o} value={o}>
              {ORDENACAO_LABEL[o]}
            </option>
          ))}
        </select>
      </div>

      {/* Filtros avançados */}
      <Dialog open={open} onOpenChange={abrir}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
              ativos > 0 ? "border-primary bg-primary/10 text-foreground" : "border-input bg-background text-foreground"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {ativos > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {ativos}
              </span>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>Refine as captações exibidas em todas as colunas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Valor de venda (R$)</Label>
              <div className="flex items-center gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="Mínimo"
                  value={valorMin}
                  onChange={(e) => setValorMin(e.target.value)}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  inputMode="numeric"
                  placeholder="Máximo"
                  value={valorMax}
                  onChange={(e) => setValorMax(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quartosMin">Quartos (mínimo)</Label>
              <Input
                id="quartosMin"
                inputMode="numeric"
                placeholder="Qualquer"
                value={quartosMin}
                onChange={(e) => setQuartosMin(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={soParadas}
                onChange={(e) => setSoParadas(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Somente paradas há 3+ dias
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={limpar}>
              Limpar
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={aplicar}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
