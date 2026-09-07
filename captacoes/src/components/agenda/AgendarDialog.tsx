"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Home, Video } from "lucide-react";
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
import { useApp } from "@/stores/app";
import { hojeLocal } from "@/lib/contadores";
import { cn } from "@/lib/utils";
import type { Captacao } from "@/types";
import type { TipoCompromisso } from "@/lib/agendamento";

const DURACOES = [30, 60, 120];

/** ISO com fuso local a partir dos campos de data e hora do formulário. */
function paraIso(dia: string, hora: string): string {
  return new Date(`${dia}T${hora}:00`).toISOString();
}

/** Preenche data e hora com o que já está agendado, senão amanhã às 10:00. */
function inicial(c: Captacao, tipo: TipoCompromisso): { dia: string; hora: string; duracao: number } {
  const em = tipo === "visita" ? c.visita_em : c.gravacao_em;
  const data = tipo === "visita" ? c.visita_data : c.gravacao_data;
  const duracao = tipo === "visita" ? c.visita_duracao_min : c.gravacao_duracao_min;

  if (em) {
    const d = new Date(em);
    return {
      dia: hojeLocal(d),
      hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      duracao: duracao || 60,
    };
  }
  if (data) return { dia: data, hora: "10:00", duracao: duracao || 60 };

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  return { dia: hojeLocal(amanha), hora: "10:00", duracao: 60 };
}

/**
 * Agendar visita ou gravação. A hora é nova na v2 — o evento no Google
 * precisa de início e fim. O atalho "mesmo dia" continua existindo, agora
 * criando os dois compromissos com uma hora de diferença.
 */
export function AgendarDialog({
  captacao,
  tipo,
  open,
  onOpenChange,
}: {
  captacao: Captacao;
  tipo: TipoCompromisso;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { patch, beginSave, endSave } = useApp();
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("10:00");
  const [duracao, setDuracao] = useState(60);
  const [mesmoDia, setMesmoDia] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    const i = inicial(captacao, tipo);
    setDia(i.dia);
    setHora(i.hora);
    setDuracao(i.duracao);
    setMesmoDia(false);
  }, [open, captacao, tipo]);

  const outroTipo: TipoCompromisso = tipo === "visita" ? "gravacao" : "visita";
  const jaAgendado = tipo === "visita" ? captacao.visita_em ?? captacao.visita_data : captacao.gravacao_em ?? captacao.gravacao_data;

  async function enviar(t: TipoCompromisso, quando: string | null, dur: number) {
    const res = await fetch("/api/agendamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captacaoId: captacao.id, tipo: t, quando, duracaoMin: dur }),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { naAgenda: boolean };
  }

  async function agendar() {
    if (!dia || !hora) return;
    setSalvando(true);
    beginSave();
    try {
      const quando = paraIso(dia, hora);
      const r = await enviar(tipo, quando, duracao);

      const patchLocal: Partial<Captacao> =
        tipo === "visita"
          ? { visita_em: quando, visita_data: dia, visita_duracao_min: duracao }
          : { gravacao_em: quando, gravacao_data: dia, gravacao_duracao_min: duracao };

      if (mesmoDia) {
        // Uma hora depois do primeiro, para não colidirem na agenda.
        const depois = new Date(new Date(quando).getTime() + duracao * 60_000).toISOString();
        await enviar(outroTipo, depois, duracao);
        Object.assign(
          patchLocal,
          outroTipo === "visita"
            ? { visita_em: depois, visita_data: dia, visita_duracao_min: duracao }
            : { gravacao_em: depois, gravacao_data: dia, gravacao_duracao_min: duracao }
        );
      }

      patch(captacao.id, patchLocal);
      endSave(true);

      if (r.naAgenda) toast.success("Agendado e espelhado na Google Agenda.");
      else toast.warning("Agendado. O evento não entrou na Google Agenda — confira a integração.");

      onOpenChange(false);
    } catch {
      endSave(false);
      toast.error("Não foi possível agendar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desmarcar() {
    setSalvando(true);
    beginSave();
    try {
      await enviar(tipo, null, duracao);
      patch(
        captacao.id,
        tipo === "visita"
          ? { visita_em: null, visita_data: null, visita_google_event_id: null }
          : { gravacao_em: null, gravacao_data: null, gravacao_google_event_id: null }
      );
      endSave(true);
      toast.success("Compromisso desmarcado e removido da agenda.");
      onOpenChange(false);
    } catch {
      endSave(false);
      toast.error("Não foi possível desmarcar.");
    } finally {
      setSalvando(false);
    }
  }

  const Icone = tipo === "visita" ? Home : Video;
  const tom = tipo === "visita" ? { bg: "#e5efe8", fg: "#2f6b46" } : { bg: "#e3edf1", fg: "#2f5b6f" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
              style={{ background: tom.bg }}
            >
              <Icone className="h-5 w-5" style={{ color: tom.fg }} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-serif text-xl leading-tight">
                Agendar {tipo === "visita" ? "visita" : "gravação"}
              </DialogTitle>
              <DialogDescription className="truncate">
                {captacao.endereco}
                {captacao.bairro && ` · ${captacao.bairro}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex gap-2.5">
            <div className="flex-[1.35] space-y-2">
              <Label htmlFor="dia">Data</Label>
              <input
                id="dia"
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] font-semibold text-foreground"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="hora">Hora</Label>
              <input
                id="hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-[15px] font-semibold text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <Label>Duração</Label>
            <div className="flex gap-2">
              {DURACOES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuracao(d)}
                  aria-pressed={duracao === d}
                  className={cn(
                    "h-10 flex-1 rounded-xl border text-[13px] font-semibold",
                    duracao === d
                      ? "border-secondary bg-secondary text-secondary-foreground"
                      : "border-input bg-card text-foreground"
                  )}
                >
                  {d < 60 ? `${d} min` : `${d / 60} hora${d > 60 ? "s" : ""}`}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ece9cf] bg-[#faf9ef] p-3.5">
            <input
              type="checkbox"
              checked={mesmoDia}
              onChange={(e) => setMesmoDia(e.target.checked)}
              className="h-5 w-5 rounded-md accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-foreground">
                {tipo === "visita" ? "Gravar" : "Visitar"} no mesmo dia
              </span>
              <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                Cria também {tipo === "visita" ? "a gravação" : "a visita"} logo em seguida
              </span>
            </span>
          </label>

          <p className="flex gap-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            <CalendarDays className="mt-px h-4 w-4 flex-none" />
            <span>
              Entra na <strong className="font-semibold text-foreground">agenda da Morabilidade</strong> no
              Google. Desmarcar aqui remove o evento de lá.
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {jaAgendado ? (
            <Button variant="ghost" onClick={desmarcar} disabled={salvando} className="text-destructive">
              Desmarcar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={agendar} disabled={salvando || !dia || !hora}>
              Agendar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
