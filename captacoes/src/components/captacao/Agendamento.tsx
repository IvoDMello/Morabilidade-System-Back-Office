"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Captacao } from "@/types";

export function Agendamento({ captacao }: { captacao: Captacao }) {
  const [visitaOk, setVisitaOk] = useState(captacao.visita_concluida);
  const [visitaData, setVisitaData] = useState(captacao.visita_data ?? "");
  const [gravacaoOk, setGravacaoOk] = useState(captacao.gravacao_concluida);
  const [gravacaoData, setGravacaoData] = useState(captacao.gravacao_data ?? "");
  const [mesmoDia, setMesmoDia] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar(patch: Partial<Captacao>) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("captacao").update(patch).eq("id", captacao.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar agendamento.");
    else toast.success("Agendamento atualizado.");
  }

  function aplicarMesmoDia() {
    if (!mesmoDia) return;
    setVisitaData(mesmoDia);
    setGravacaoData(mesmoDia);
    salvar({ visita_data: mesmoDia, gravacao_data: mesmoDia });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="visita"
            checked={visitaOk}
            onCheckedChange={(v) => {
              const ok = Boolean(v);
              setVisitaOk(ok);
              salvar({ visita_concluida: ok });
            }}
          />
          <Label htmlFor="visita">Visita concluída</Label>
        </div>
        <Input
          type="date"
          className="mt-2"
          value={visitaData}
          onChange={(e) => setVisitaData(e.target.value)}
          onBlur={() => salvar({ visita_data: visitaData || null })}
        />
      </div>

      <div className="rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="gravacao"
            checked={gravacaoOk}
            onCheckedChange={(v) => {
              const ok = Boolean(v);
              setGravacaoOk(ok);
              salvar({ gravacao_concluida: ok });
            }}
          />
          <Label htmlFor="gravacao">Gravação concluída</Label>
        </div>
        <Input
          type="date"
          className="mt-2"
          value={gravacaoData}
          onChange={(e) => setGravacaoData(e.target.value)}
          onBlur={() => salvar({ gravacao_data: gravacaoData || null })}
        />
      </div>

      <div className="rounded-md border border-dashed p-3">
        <Label className="text-xs text-muted-foreground">Visita e gravação no mesmo dia</Label>
        <div className="mt-1.5 flex gap-2">
          <Input type="date" value={mesmoDia} onChange={(e) => setMesmoDia(e.target.value)} />
          <Button type="button" variant="outline" onClick={aplicarMesmoDia} disabled={saving}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}
