"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, X } from "lucide-react";
import { toast } from "sonner";
import { decidirCaptacao } from "@/lib/decisao";
import { pendenciaDaCaptacao, PENDENCIA_LABEL } from "@/lib/etapa";
import { AgendarDialog } from "@/components/agenda/AgendarDialog";
import { ReprovarDialog } from "./ReprovarDialog";
import type { Captacao, Perfil } from "@/types";

/**
 * Barra fixa do rodapé do detalhe (mobile).
 *
 * Enquanto a captação não foi decidida, são os dois botões de decisão —
 * reprovar agora abre o diálogo que coleta motivo, responsável e prazo do
 * retorno. Depois de aprovada, a barra passa a ser a PRÓXIMA AÇÃO PENDENTE,
 * que é o que a pessoa realmente precisa fazer ali.
 *
 * Verde chapado, o mesmo do botão Aprovar do cartão da fila: é a mesma ação,
 * e o degradê com sombra fazia dela um elemento diferente em cada tela.
 */
export function DecisaoBar({
  captacao,
  perfis,
  userId,
}: {
  captacao: Captacao;
  perfis: Perfil[];
  userId: string;
}) {
  const [salvando, setSalvando] = useState(false);
  const [reprovando, setReprovando] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const router = useRouter();

  const emDecisao = captacao.status === "em_decisao" && !captacao.decisao;
  const pendencia = pendenciaDaCaptacao(captacao);

  async function aprovar() {
    setSalvando(true);
    const resultado = await decidirCaptacao(captacao, "aprovada");
    setSalvando(false);
    if (resultado === "cancelado") return;
    if (resultado === "erro") return toast.error("Não foi possível registrar a decisão.");
    toast.success("Captação aprovada.");
    router.push("/aprovadas");
    router.refresh();
  }

  if (emDecisao) {
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-[#e6e7e1] bg-white px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(46,48,42,0.2)] lg:hidden">
          <button
            type="button"
            onClick={() => setReprovando(true)}
            disabled={salvando}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-[#e2bebe] bg-white px-5 text-sm font-semibold text-[#9a3b3b] disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Reprovar
          </button>
          <button
            type="button"
            onClick={aprovar}
            disabled={salvando}
            className="inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2f6b46] text-sm font-semibold text-white disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Aprovar captação
          </button>
        </div>

        <ReprovarDialog
          captacao={captacao}
          open={reprovando}
          onOpenChange={setReprovando}
          perfis={perfis}
          userId={userId}
          onReprovada={() => {
            router.push("/negativadas");
            router.refresh();
          }}
        />
      </>
    );
  }

  if (!pendencia) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e6e7e1] bg-white px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(46,48,42,0.2)] lg:hidden">
        <button
          type="button"
          onClick={() => setAgendando(true)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2f6b46] text-[15.5px] font-bold text-white"
        >
          <CalendarDays className="h-[18px] w-[18px]" />
          {PENDENCIA_LABEL[pendencia]}
        </button>
      </div>

      <AgendarDialog
        captacao={captacao}
        tipo={pendencia === "agendar_visita" ? "visita" : "gravacao"}
        open={agendando}
        onOpenChange={(v) => {
          setAgendando(v);
          if (!v) router.refresh();
        }}
      />
    </>
  );
}
