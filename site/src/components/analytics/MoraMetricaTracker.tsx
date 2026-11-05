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

/** Onde a busca caiu: a rua (código do logradouro) e o bairro. */
export interface LocalBuscaMoraMetrica {
  cl?: number;
  bairro?: string;
}

interface Props {
  /** Identidade da busca (texto, rua, número, unidade, bairro), sem filtros. */
  busca: string;
  tipo: TipoBuscaMoraMetrica;
  local?: LocalBuscaMoraMetrica;
}

/**
 * Registra cada busca feita na MoraMétrica. A busca muda só a query string, que
 * o AnalyticsTracker não vê. Trocar filtro, ordem ou página do mesmo resultado
 * não conta como outra busca. Vai o tipo de resultado e, quando a busca achou
 * algo, a rua e o bairro, para o ranking do painel. Nunca o número do prédio
 * nem a unidade.
 */
export function MoraMetricaTracker({ busca, tipo, local }: Props) {
  const ultimaBusca = useRef<string | null>(null);
  const cl = local?.cl;
  const bairro = local?.bairro;

  useEffect(() => {
    if (ultimaBusca.current === busca) return;
    ultimaBusca.current = busca;

    sendBeaconJSON("/publico/morametrica", {
      session_id: getOrCreateSessionId(),
      tipo,
      ...(cl ? { cl } : {}),
      ...(bairro ? { bairro } : {}),
    });
  }, [busca, tipo, cl, bairro]);

  return null;
}
