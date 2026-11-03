"use client";

import { useEffect, useRef } from "react";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

export type TipoBuscaMoraMetrica =
  | "predio"
  | "unidade"
  | "rua"
  | "bairro"
  | "ambiguo"
  | "nenhum"
  | "erro";

interface Props {
  /** Identidade da busca (texto, rua, número, unidade, bairro), sem filtros. */
  busca: string;
  tipo: TipoBuscaMoraMetrica;
}

/**
 * Registra cada busca feita na MoraMétrica. A busca muda só a query string, que
 * o AnalyticsTracker não vê. Trocar filtro, ordem ou página do mesmo resultado
 * não conta como outra busca. Vai só o tipo de resultado, nunca o endereço.
 */
export function MoraMetricaTracker({ busca, tipo }: Props) {
  const ultimaBusca = useRef<string | null>(null);

  useEffect(() => {
    if (ultimaBusca.current === busca) return;
    ultimaBusca.current = busca;

    sendBeaconJSON("/publico/morametrica", {
      session_id: getOrCreateSessionId(),
      tipo,
    });
  }, [busca, tipo]);

  return null;
}
