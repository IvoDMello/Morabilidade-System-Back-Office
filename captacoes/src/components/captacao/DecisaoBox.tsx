"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import type { Captacao, Decisao, Status } from "@/types";

/**
 * Registra aprovação/reprovação e encaminha o cartão:
 *  aprovada  -> pendente_agendar_visita
 *  reprovada -> pendente_negativa
 * Tudo de forma atômica via RPC mover_cartao (status + decisão + histórico).
 */
export function DecisaoBox({ captacao }: { captacao: Captacao }) {
  const [saving, setSaving] = useState<Decisao | null>(null);
  const router = useRouter();

  async function decidir(decisao: Decisao) {
    // Re-decidir uma captação que já virou imóvel: confirma para evitar engano.
    if (
      decisao === "reprovada" &&
      captacao.decisao === "aprovada" &&
      captacao.imovel_codigo &&
      !window.confirm(
        `Esta captação já foi cadastrada como imóvel ${captacao.imovel_codigo}. Reprovar aqui não remove o imóvel do sistema — só muda o status da captação. Continuar?`,
      )
    ) {
      return;
    }
    setSaving(decisao);
    const supabase = createClient();
    const destino: Status = decisao === "aprovada" ? "pendente_agendar_visita" : "pendente_negativa";

    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: destino,
      p_ordem: orderBetween(null, null),
      p_decisao: decisao,
    });
    setSaving(null);

    if (error) {
      toast.error("Não foi possível registrar a decisão.");
      return;
    }
    toast.success(decisao === "aprovada" ? "Captação aprovada." : "Captação reprovada.");
    router.refresh();
  }

  if (captacao.decisao) {
    const oposta: Decisao = captacao.decisao === "aprovada" ? "reprovada" : "aprovada";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Decisão registrada:</span>
          <Badge variant={captacao.decisao === "aprovada" ? "positive" : "destructive"}>
            {captacao.decisao}
          </Badge>
          {captacao.decisao_em && (
            <span className="text-xs text-muted-foreground">
              em {new Date(captacao.decisao_em).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Mudou de ideia?</span>
          <Button
            variant={oposta === "aprovada" ? "positive" : "destructive"}
            size="sm"
            onClick={() => decidir(oposta)}
            disabled={saving !== null}
          >
            {oposta === "aprovada" ? (
              <>
                <Check className="h-4 w-4" /> Aprovar
              </>
            ) : (
              <>
                <X className="h-4 w-4" /> Reprovar
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="positive" onClick={() => decidir("aprovada")} disabled={saving !== null}>
        <Check className="h-4 w-4" /> Aprovar
      </Button>
      <Button variant="destructive" onClick={() => decidir("reprovada")} disabled={saving !== null}>
        <X className="h-4 w-4" /> Reprovar
      </Button>
    </div>
  );
}
