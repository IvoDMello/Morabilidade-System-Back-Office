"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, XCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { confirmarDecisao, destinoDecisao, ordemFimDaColuna } from "@/lib/decisao";
import { responsavelPadrao } from "@/lib/retorno";
import { hojeLocal } from "@/lib/contadores";
import { useApp } from "@/stores/app";
import { cn } from "@/lib/utils";
import type { Captacao, Perfil } from "@/types";

/** "YYYY-MM-DD" daqui a N dias, no fuso de quem está usando. */
function emDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return hojeLocal(d);
}

/**
 * Reprovar deixa de ser um clique solto: coleta o MOTIVO (que é o que vai ser
 * dito ao proprietário), quem dá o retorno e até quando. A captação vai para
 * a fila da aba Negativadas — não para a Google Agenda.
 */
export function ReprovarDialog({
  captacao,
  open,
  onOpenChange,
  onReprovada,
  perfis: perfisProp,
  userId: userIdProp,
}: {
  captacao: Captacao;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onReprovada?: () => void;
  /** O detalhe da captação vive fora do store das abas e passa os dados. */
  perfis?: Perfil[];
  userId?: string;
}) {
  const store = useApp();
  const cards = store.cards;
  const perfis = perfisProp ?? store.perfis;
  const userId = userIdProp ?? store.userId;
  const { decidir, patch, beginSave, endSave } = store;

  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [prazo, setPrazo] = useState(emDias(3));
  const [salvando, setSalvando] = useState(false);

  const padrao = useMemo(() => responsavelPadrao(cards, userId), [cards, userId]);

  useEffect(() => {
    if (!open) return;
    setMotivo(captacao.decisao_motivo ?? "");
    setResponsavel(captacao.retorno_responsavel ?? padrao);
    setPrazo(captacao.retorno_prazo ?? emDias(3));
  }, [open, captacao, padrao]);

  const motivoValido = motivo.trim().length > 0;

  async function reprovar() {
    if (!motivoValido || !confirmarDecisao(captacao, "reprovada")) return;

    setSalvando(true);
    beginSave();
    const destino = destinoDecisao("reprovada");
    const ordem = await ordemFimDaColuna(destino);

    const supabase = createClient();
    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: destino,
      p_ordem: ordem,
      p_decisao: "reprovada",
    });

    if (error) {
      setSalvando(false);
      endSave(false);
      return toast.error("Não foi possível reprovar a captação.");
    }

    // O RPC cuida de status/decisão/histórico; os campos do retorno são da v2
    // e vão num update à parte, para não mexer na assinatura da função.
    const retorno = {
      decisao_motivo: motivo.trim(),
      retorno_responsavel: responsavel || null,
      retorno_prazo: prazo || null,
      retorno_feito: false,
    };
    const { error: erroRetorno } = await supabase
      .from("captacao")
      .update(retorno)
      .eq("id", captacao.id);

    setSalvando(false);
    endSave(!erroRetorno);

    decidir(captacao.id, "reprovada", destino);
    patch(captacao.id, retorno);

    if (erroRetorno) {
      toast.warning("Captação reprovada, mas o retorno não foi registrado. Confira na aba Negativadas.");
    } else {
      toast.success("Reprovada. O retorno entrou na fila de Negativadas.");
    }
    onOpenChange(false);
    onReprovada?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#f7ecec]">
              <XCircle className="h-5 w-5 text-[#9a3b3b]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-serif text-xl leading-tight">Reprovar captação</DialogTitle>
              <DialogDescription className="truncate">
                {captacao.endereco}
                {captacao.bairro && ` · ${captacao.bairro}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="motivo">Motivo da reprovação</Label>
              <span className="text-[10.5px] font-semibold text-destructive">obrigatório</span>
            </div>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Valor acima da praça, prédio sem elevador…"
              autoFocus
            />
            <p className="text-[11.5px] text-muted-foreground">
              É o que vai ser dito ao proprietário no retorno.
            </p>
          </div>

          <div className="space-y-2.5">
            <Label>Retorno ao proprietário por</Label>
            <div className="flex flex-wrap gap-2">
              {perfis.map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => setResponsavel(p.user_id)}
                  aria-pressed={responsavel === p.user_id}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-xl border px-3 text-[13.5px] font-semibold",
                    responsavel === p.user_id
                      ? "border-secondary bg-muted text-foreground"
                      : "border-input bg-card text-muted-foreground"
                  )}
                >
                  <Avatar nome={p.nome} size={24} />
                  {p.nome.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label>Prazo do retorno</Label>
            <div className="flex gap-2">
              {[
                { label: "Hoje", valor: emDias(0) },
                { label: "Em 3 dias", valor: emDias(3) },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setPrazo(o.valor)}
                  aria-pressed={prazo === o.valor}
                  className={cn(
                    "h-10 flex-1 rounded-xl border text-[13px] font-semibold",
                    prazo === o.valor
                      ? "border-secondary bg-secondary text-secondary-foreground"
                      : "border-input bg-card text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
              <input
                type="date"
                aria-label="Prazo do retorno"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="h-10 flex-1 rounded-xl border border-input bg-card px-2.5 text-[13px] font-semibold text-foreground"
              />
            </div>
          </div>

          <p className="flex gap-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <Info className="mt-px h-4 w-4 flex-none" />
            <span>
              Fica em <strong className="font-semibold text-foreground">Negativadas → retornos pendentes</strong>{" "}
              até alguém marcar que avisou. Não vai para a Google Agenda.
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={reprovar}
            disabled={!motivoValido || salvando}
            className="flex-1 border border-[#e6c5c5] bg-[#f7ecec] text-[#9a3b3b] hover:bg-[#f2e2e2] sm:flex-none"
          >
            Reprovar captação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
