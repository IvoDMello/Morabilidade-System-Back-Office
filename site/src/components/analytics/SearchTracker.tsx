"use client";

import { useEffect, useRef } from "react";
import { getOrCreateSessionId, sendBeaconJSON } from "@/lib/session";

interface Props {
  /** Snapshot dos searchParams atuais (do server component). */
  params: Record<string, string | string[] | undefined>;
  /** Quantidade de imóveis encontrados na busca. */
  total: number;
}

// Campos do form de filtros que viram chave de "filtros" no evento.
// Mantém em sync com FiltrosBar/FiltrosBusca do site público.
const CAMPOS_FILTRO = [
  "tipo_negocio",
  "tipo_imovel",
  "cidade",
  "dormitorios_min",
  "andar_max",
  "preco_min",
  "preco_max",
  "condicao",
  "mobiliado",
  "codigo",
] as const;

function montarFiltros(params: Props["params"]): {
  termo: string | null;
  filtros: Record<string, unknown>;
} {
  const filtros: Record<string, unknown> = {};
  for (const k of CAMPOS_FILTRO) {
    const v = params[k];
    if (v == null) continue;
    const valor = Array.isArray(v) ? v[0] : v;
    if (valor) filtros[k] = valor;
  }
  // bairro é multi
  const bairro = params["bairro"];
  if (bairro) {
    const lista = Array.isArray(bairro) ? bairro : [bairro];
    if (lista.length > 0) filtros["bairro"] = lista;
  }
  const q = params["q"];
  const termo = typeof q === "string" ? q : Array.isArray(q) ? q[0] : null;
  return { termo: termo || null, filtros };
}

function chaveEvento(params: Props["params"], total: number): string {
  // Evita disparo duplicado para a mesma busca (paginação não conta como nova).
  const { termo, filtros } = montarFiltros(params);
  return `${termo ?? ""}|${JSON.stringify(filtros)}|${total}`;
}

export function SearchTracker({ params, total }: Props) {
  const ultimoEvento = useRef<string | null>(null);

  useEffect(() => {
    const { termo, filtros } = montarFiltros(params);
    // Só rastreia quando há termo ou algum filtro estruturado aplicado.
    if (!termo && Object.keys(filtros).length === 0) return;

    const chave = chaveEvento(params, total);
    if (ultimoEvento.current === chave) return;
    ultimoEvento.current = chave;

    sendBeaconJSON("/publico/busca", {
      session_id: getOrCreateSessionId(),
      termo,
      filtros,
      resultados_count: total,
    });
  }, [params, total]);

  return null;
}
