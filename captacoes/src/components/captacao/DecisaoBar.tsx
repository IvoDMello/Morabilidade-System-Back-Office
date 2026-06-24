"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import type { Captacao, Decisao, Status } from "@/types";

/**
 * Barra de decisão fixa no rodapé do detalhe (mobile). Mesma regra do DecisaoBox:
 *  aprovada  -> pendente_agendar_visita
 *  reprovada -> pendente_negativa
 * Só aparece enquanto a captação está em decisão.
 */
export function DecisaoBar({ captacao }: { captacao: Captacao }) {
  const [saving, setSaving] = useState<Decisao | null>(null);
  const router = useRouter();

  if (captacao.status !== "em_decisao" || captacao.decisao) return null;

  async function decidir(decisao: Decisao) {
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
    router.push("/board");
    router.refresh();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-[#e6e7e1] bg-white px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(46,48,42,0.2)] lg:hidden">
      <button
        type="button"
        onClick={() => decidir("reprovada")}
        disabled={saving !== null}
        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-[#e6c5c5] bg-white px-5 text-sm font-semibold text-[#9a3b3b] disabled:opacity-50"
      >
        <X className="h-4 w-4" /> Reprovar
      </button>
      <button
        type="button"
        onClick={() => decidir("aprovada")}
        disabled={saving !== null}
        className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(47,107,70,0.6)] disabled:opacity-50"
        style={{ background: "linear-gradient(150deg,#3a8a5c,#2f7350)" }}
      >
        <Check className="h-4 w-4" /> Aprovar captação
      </button>
    </div>
  );
}
