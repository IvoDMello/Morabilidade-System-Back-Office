"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Pauta } from "@/types";

export interface PautaDados {
  titulo: string;
  descricao: string | null;
  data_alvo: string | null;
}

/**
 * Criação e edição do cartão de pauta. `pauta` nula = criando.
 * Só o título é obrigatório: a data é a parte "agenda" e pode entrar depois.
 */
export function PautaDialog({
  open,
  pauta,
  onSalvar,
  onOpenChange,
}: {
  open: boolean;
  pauta?: Pauta | null;
  onSalvar: (dados: PautaDados) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");

  // Reabrir o diálogo precisa reidratar os campos com a pauta da vez.
  useEffect(() => {
    if (!open) return;
    setTitulo(pauta?.titulo ?? "");
    setDescricao(pauta?.descricao ?? "");
    setDataAlvo(pauta?.data_alvo ?? "");
  }, [open, pauta]);

  function salvar() {
    const limpo = titulo.trim();
    if (!limpo) return;
    onSalvar({
      titulo: limpo.slice(0, 120),
      descricao: descricao.trim() || null,
      data_alvo: dataAlvo || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pauta ? "Editar pauta" : "Nova pauta de gravação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pauta_titulo">Título</Label>
            <Input
              id="pauta_titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
              maxLength={120}
              placeholder="Ex.: Retorno da viagem — prioridades"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pauta_data">Dia previsto (opcional)</Label>
            <Input
              id="pauta_data"
              type="date"
              value={dataAlvo}
              onChange={(e) => setDataAlvo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O cartão avisa quando a data chega ou passa.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pauta_descricao">Observações (opcional)</Label>
            <Textarea
              id="pauta_descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={2000}
              placeholder="Ex.: combinar equipamento com o Bruno antes."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={!titulo.trim()}>
              {pauta ? "Salvar" : "Criar pauta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
