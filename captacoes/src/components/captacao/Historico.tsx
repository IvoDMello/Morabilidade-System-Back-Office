import { ArrowRight } from "lucide-react";
import { STATUS_LABEL, type Status } from "@/types";
import { relativo } from "@/lib/format";

interface Evento {
  id: string;
  de_status: Status | null;
  para_status: Status | null;
  autor: string | null;
  criado_em: string;
}

export function Historico({ eventos, nomes = {} }: { eventos: Evento[]; nomes?: Record<string, string> }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem movimentações registradas.</p>;
  }

  return (
    <ol className="space-y-3">
      {eventos.map((e) => (
        <li key={e.id} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="text-muted-foreground">
            {e.de_status ? STATUS_LABEL[e.de_status] : "Criada"}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{e.para_status ? STATUS_LABEL[e.para_status] : "-"}</span>
          <span className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
            {e.autor && nomes[e.autor] && <span>{nomes[e.autor]} · </span>}
            {relativo(e.criado_em)}
          </span>
        </li>
      ))}
    </ol>
  );
}
