"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useBoard } from "@/stores/board";
import type { Captacao } from "@/types";

/**
 * Aberto logo após mover um cartão para a Gaveta: registra por que o imóvel
 * foi engavetado e (opcionalmente) quando reavaliar. Fechar sem salvar é ok —
 * o cartão já está na gaveta, só fica sem os metadados.
 */
export function GavetaDialog({ card, onClose }: { card: Captacao | null; onClose: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [revisao, setRevisao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { upsert, find } = useBoard();

  async function salvar() {
    if (!card) return;
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      gaveta_motivo: motivo.trim() || null,
      gaveta_revisao_em: revisao || null,
    };
    const { error } = await supabase.from("captacao").update(payload).eq("id", card.id);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar os detalhes da gaveta.");
      return;
    }
    const atual = find(card.id);
    if (atual) upsert({ ...atual, ...payload });
    onClose();
  }

  return (
    <Dialog
      open={!!card}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviada para a Gaveta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{card?.endereco}</p>

          <div className="space-y-1.5">
            <Label htmlFor="gaveta_motivo">Por que engavetar? (opcional)</Label>
            <Textarea
              id="gaveta_motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: preço fora do mercado, proprietário indeciso…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gaveta_revisao">Reavaliar em (opcional)</Label>
            <Input
              id="gaveta_revisao"
              type="date"
              value={revisao}
              onChange={(e) => setRevisao(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O card ganha um aviso de “revisar agora” quando a data chegar.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Agora não
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
