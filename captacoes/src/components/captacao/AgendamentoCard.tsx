"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, Home, Video } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AgendarDialog } from "@/components/agenda/AgendarDialog";
import { createClient } from "@/lib/supabase/client";
import { dataCurta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Captacao } from "@/types";
import type { TipoCompromisso } from "@/lib/agendamento";

/**
 * Agendamento no detalhe da captação.
 *
 * Substitui o formulário antigo, que gravava `visita_data`/`gravacao_data`
 * direto: aquele caminho não tinha hora e, pior, não espelhava nada na Google
 * Agenda — dava para limpar aqui uma data criada pelo diálogo e deixar o
 * evento órfão lá. Agora agendar é sempre pelo mesmo diálogo.
 *
 * O checkbox "concluída" continua aqui e é ele que alimenta a contabilidade
 * de gravações (`foiGravada` exige `gravacao_concluida`): agendar diz o que
 * VAI acontecer, marcar concluída diz o que ACONTECEU.
 */
export function AgendamentoCard({ captacao }: { captacao: Captacao }) {
  const [c, setC] = useState(captacao);
  const [agendando, setAgendando] = useState<TipoCompromisso | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function marcarConcluida(tipo: TipoCompromisso, ok: boolean) {
    const campo = tipo === "visita" ? "visita_concluida" : "gravacao_concluida";
    const antes = c;
    setC({ ...c, [campo]: ok });
    setSalvando(true);

    const supabase = createClient();
    const { error } = await supabase.from("captacao").update({ [campo]: ok }).eq("id", c.id);
    setSalvando(false);

    if (error) {
      setC(antes);
      return toast.error("Não foi possível salvar.");
    }
    if (tipo === "gravacao" && ok) toast.success("Gravação concluída. Já entra na contagem do mês.");
  }

  return (
    <div className="space-y-3">
      <Linha
        tipo="visita"
        captacao={c}
        salvando={salvando}
        onAgendar={() => setAgendando("visita")}
        onConcluir={(ok) => marcarConcluida("visita", ok)}
      />
      <Linha
        tipo="gravacao"
        captacao={c}
        salvando={salvando}
        onAgendar={() => setAgendando("gravacao")}
        onConcluir={(ok) => marcarConcluida("gravacao", ok)}
      />

      {agendando && (
        <AgendarDialog
          captacao={c}
          tipo={agendando}
          open
          onOpenChange={(v) => {
            if (!v) {
              setAgendando(null);
              // O diálogo grava pelo route handler; recarrega o cartão para a
              // tela refletir data, hora e o resultado do espelho na Agenda.
              createClient()
                .from("captacao")
                .select("*")
                .eq("id", c.id)
                .single()
                .then(({ data }) => data && setC(data as Captacao));
            }
          }}
        />
      )}
    </div>
  );
}

const TOM = {
  visita: { bg: "#e5efe8", fg: "#2f6b46", Icone: Home, label: "Visita" },
  gravacao: { bg: "#e3edf1", fg: "#2f5b6f", Icone: Video, label: "Gravação" },
} as const;

function Linha({
  tipo,
  captacao,
  salvando,
  onAgendar,
  onConcluir,
}: {
  tipo: TipoCompromisso;
  captacao: Captacao;
  salvando: boolean;
  onAgendar: () => void;
  onConcluir: (ok: boolean) => void;
}) {
  const tom = TOM[tipo];
  const em = tipo === "visita" ? captacao.visita_em : captacao.gravacao_em;
  const data = tipo === "visita" ? captacao.visita_data : captacao.gravacao_data;
  const concluida = tipo === "visita" ? captacao.visita_concluida : captacao.gravacao_concluida;
  const noGoogle =
    tipo === "visita" ? captacao.visita_google_event_id : captacao.gravacao_google_event_id;

  const quando = em
    ? `${dataCurta(em)} às ${new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : data
      ? dataCurta(data)
      : null;

  return (
    <div className="rounded-xl border p-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl"
          style={{ background: tom.bg }}
        >
          <tom.Icone className="h-[18px] w-[18px]" style={{ color: tom.fg }} strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{tom.label}</p>
          <p
            className={cn(
              "mt-0.5 text-[12.5px]",
              quando ? "text-muted-foreground" : "font-semibold text-destructive"
            )}
          >
            {quando ?? "a agendar"}
            {quando && !em && " · sem hora"}
          </p>
        </div>

        <button
          type="button"
          onClick={onAgendar}
          className="flex-none rounded-lg border px-3 py-2 text-xs font-semibold text-foreground"
        >
          {quando ? "Reagendar" : "Agendar"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
          <Checkbox
            checked={concluida}
            disabled={salvando}
            onCheckedChange={(v) => onConcluir(Boolean(v))}
          />
          {tipo === "visita" ? "Visita realizada" : "Gravação concluída"}
        </label>

        {noGoogle && (
          <span className="flex flex-none items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            na agenda
            <Check className="h-3 w-3 text-[#2f6b46]" strokeWidth={3} />
          </span>
        )}
      </div>
    </div>
  );
}
