"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { dataCurta } from "@/lib/format";
import type { Captacao } from "@/types";

/** Data de hoje em YYYY-MM-DD (fuso local), para o input date. */
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Estado terminal do fluxo: marca a captação como "publicada" (gravada e postada).
 * O cartão sai do quadro e passa a ser consultável na aba "Publicadas".
 * Quando já publicada, permite reverter (volta para "Agendar gravação").
 */
export function PublicarCaptacao({ captacao }: { captacao: Captacao }) {
  const [data, setData] = useState(hojeISO());
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function publicar() {
    setSaving(true);
    const supabase = createClient();
    // Ordem dentro da coluna oculta é irrelevante (lista ordena por data);
    // um valor crescente evita colisões.
    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: "publicada",
      p_ordem: Date.now(),
      p_decisao: null,
    });
    if (!error && data && data !== hojeISO()) {
      // Honra a data escolhida (ex.: publicado ontem).
      await supabase
        .from("captacao")
        .update({ publicada_em: new Date(data + "T12:00:00").toISOString() })
        .eq("id", captacao.id);
    }
    setSaving(false);
    if (error) {
      toast.error("Não foi possível marcar como publicada.");
      return;
    }
    toast.success("Captação publicada. Movida para a aba Publicadas.");
    router.push("/board");
    router.refresh();
  }

  async function reverter() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("mover_cartao", {
      p_captacao_id: captacao.id,
      p_para_status: "pendente_agendar_gravacao",
      p_ordem: Date.now(),
      p_decisao: null,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível reverter.");
      return;
    }
    toast.success("Publicação revertida. Cartão de volta ao quadro.");
    router.refresh();
  }

  if (captacao.status === "publicada") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-[#2f6b46]">
          <CheckCircle2 className="h-4 w-4" />
          Publicada {captacao.publicada_em ? `em ${dataCurta(captacao.publicada_em)}` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={reverter} disabled={saving}>
          <Undo2 className="h-4 w-4" /> Reverter publicação
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Já gravou e postou o vídeo? Marque como publicada — o cartão sai do quadro e fica guardado na aba
        Publicadas com a data.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="publicada_em" className="text-xs text-muted-foreground">
            Data da publicação
          </Label>
          <Input
            id="publicada_em"
            type="date"
            className="mt-1 w-auto"
            value={data}
            max={hojeISO()}
            onChange={(e) => setData(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={publicar}
          disabled={saving}
          className="bg-[#2f7350] text-white hover:bg-[#286444]"
        >
          <CheckCircle2 className="h-4 w-4" /> Marcar como publicada
        </Button>
      </div>
    </div>
  );
}
