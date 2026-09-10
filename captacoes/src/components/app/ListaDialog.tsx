"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COR_LISTA } from "@/lib/listas";
import { criarLista, editarLista, excluirLista, quantasNaLista } from "@/lib/listas-api";
import { CORES_LISTA, type CorLista, type Lista } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Criar ou editar uma lista. Apagar remove a etiqueta, nunca a captação —
 * e a interface diz isso com a contagem antes de confirmar.
 */
export function ListaDialog({
  open,
  onOpenChange,
  lista,
  onCriada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Ausente = criar. */
  lista?: Lista;
  onCriada?: (l: Lista) => void;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<CorLista>("ambar");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(lista?.nome ?? "");
    setCor(lista?.cor ?? "ambar");
  }, [open, lista]);

  const nomeValido = nome.trim().length > 0 && nome.trim().length <= 40;

  async function salvar() {
    if (!nomeValido) return;
    setSalvando(true);
    if (lista) {
      const r = await editarLista(lista.id, { nome, cor });
      setSalvando(false);
      if (!r.ok) return toast.error(r.erro);
      toast.success("Lista atualizada.");
    } else {
      const r = await criarLista(nome, cor);
      setSalvando(false);
      if (!r.ok) return toast.error(r.erro);
      toast.success(`Lista "${r.dados.nome}" criada.`);
      onCriada?.(r.dados);
    }
    onOpenChange(false);
  }

  async function apagar() {
    if (!lista) return;
    const n = quantasNaLista(lista.id);
    const aviso =
      n === 0
        ? `Apagar a lista "${lista.nome}"?`
        : `Apagar a lista "${lista.nome}"? Remove a etiqueta de ${n} captaç${n === 1 ? "ão" : "ões"}. Nenhuma captação é excluída.`;
    if (!window.confirm(aviso)) return;

    setSalvando(true);
    const r = await excluirLista(lista.id);
    setSalvando(false);
    if (!r.ok) return toast.error(r.erro);
    toast.success("Lista apagada. Nenhuma captação foi excluída.");
    onOpenChange(false);
  }

  const estilo = COR_LISTA[cor];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{lista ? "Editar lista" : "Nova lista"}</DialogTitle>
          <DialogDescription>
            Listas organizam as aprovadas — mas dá para etiquetar antes, ainda em Decidir. Uma
            captação pode estar em quantas você quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="lista-nome">Nome</Label>
            <Input
              id="lista-nome"
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Prioridade, Fora de área…"
              autoFocus
            />
          </div>

          <div className="space-y-2.5">
            <Label>Cor</Label>
            <div className="flex items-center gap-3">
              {CORES_LISTA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  aria-label={COR_LISTA[c].label}
                  aria-pressed={c === cor}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-transform",
                    c === cor && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                  style={{ background: COR_LISTA[c].dot }}
                >
                  {c === cor && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed bg-muted/40 p-3.5">
            <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              Como vai aparecer
            </p>
            <span
              className="inline-flex h-[26px] items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold"
              style={{ background: estilo.bg, color: estilo.fg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: estilo.dot }} />
              {nome.trim() || "Nome da lista"}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {lista && !lista.permanente ? (
            <Button variant="ghost" onClick={apagar} disabled={salvando} className="text-destructive">
              <Trash2 className="mr-1.5 h-4 w-4" />
              Apagar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!nomeValido || salvando}>
              {lista ? "Salvar" : "Criar lista"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
