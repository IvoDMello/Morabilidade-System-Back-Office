"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { decidirCaptacao } from "@/lib/decisao";
import { ReprovarDialog } from "./ReprovarDialog";
import { DECISAO_LABEL, type Captacao, type Decisao, type Perfil } from "@/types";

/**
 * Registra aprovação/reprovação e encaminha o cartão (regras em lib/decisao):
 *  aprovada  -> pendente_agendar_visita
 *  reprovada -> pendente_negativa
 *
 * Reprovar SEMPRE passa pelo ReprovarDialog, igual à barra do mobile e ao
 * cartão da aba Decidir. Antes este era o único ponto que chamava
 * `decidirCaptacao("reprovada")` direto — e como a barra do rodapé é
 * `lg:hidden`, no DESKTOP era o único caminho possível. A captação ia para
 * a etapa negativada sem motivo, sem responsável e sem prazo, e como a aba
 * Negativadas abre em "Suas" (filtra por responsável), sumia da tela: não
 * estava mais em Decidir e não aparecia em Negativadas.
 */
export function DecisaoBox({
  captacao,
  autorNome,
  perfis = [],
  userId = "",
}: {
  captacao: Captacao;
  autorNome?: string | null;
  perfis?: Perfil[];
  userId?: string;
}) {
  const [saving, setSaving] = useState<Decisao | null>(null);
  const [reprovando, setReprovando] = useState(false);
  const router = useRouter();

  async function decidir(decisao: Decisao) {
    if (decisao === "reprovada") {
      setReprovando(true);
      return;
    }
    setSaving(decisao);
    const resultado = await decidirCaptacao(captacao, decisao);
    setSaving(null);
    if (resultado === "cancelado") return;
    if (resultado === "erro") {
      toast.error("Não foi possível registrar a decisão.");
      return;
    }
    toast.success("Captação aprovada.");
    router.refresh();
  }

  const dialogo = (
    <ReprovarDialog
      captacao={captacao}
      open={reprovando}
      onOpenChange={setReprovando}
      perfis={perfis}
      userId={userId}
      onReprovada={() => router.refresh()}
    />
  );

  if (captacao.decisao) {
    const oposta: Decisao = captacao.decisao === "aprovada" ? "reprovada" : "aprovada";
    return (
      <div className="space-y-3">
        {dialogo}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Decisão registrada:</span>
          <Badge variant={captacao.decisao === "aprovada" ? "positive" : "destructive"}>
            {DECISAO_LABEL[captacao.decisao]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {autorNome ? `por ${autorNome}` : ""}
            {captacao.decisao_em &&
              ` em ${new Date(captacao.decisao_em).toLocaleDateString("pt-BR")}`}
          </span>
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
      {dialogo}
      <Button variant="positive" onClick={() => decidir("aprovada")} disabled={saving !== null}>
        <Check className="h-4 w-4" /> Aprovar
      </Button>
      <Button variant="destructive" onClick={() => decidir("reprovada")} disabled={saving !== null}>
        <X className="h-4 w-4" /> Reprovar
      </Button>
    </div>
  );
}
