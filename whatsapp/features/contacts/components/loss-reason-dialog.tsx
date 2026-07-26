"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LOSS_REASONS, LOSS_REASON_LABELS, type LossReason } from "@/constants/loss-reasons";

interface LossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: LossReason, note: string | null) => void;
}

export function LossReasonDialog({ open, onOpenChange, onConfirm }: LossReasonDialogProps) {
  const [reason, setReason] = useState<LossReason | "">("");
  const [note, setNote] = useState("");

  const noteRequired = reason === "outro";
  const canConfirm = reason !== "" && (!noteRequired || note.trim().length > 0);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason("");
      setNote("");
    }
    onOpenChange(nextOpen);
  }

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(reason as LossReason, note.trim() || null);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-l-4 border-l-primary">
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
          <DialogDescription>
            Antes de marcar este contato como perdido, registre o motivo — isso alimenta as
            estatísticas de perdas mais adiante.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Motivo *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as LossReason)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o motivo">
                  {(value: string) => LOSS_REASON_LABELS[value as LossReason]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {noteRequired && (
            <div className="flex flex-col gap-1.5">
              <Label>Detalhe *</Label>
              <Textarea
                rows={3}
                placeholder="Descreva o motivo da perda"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
