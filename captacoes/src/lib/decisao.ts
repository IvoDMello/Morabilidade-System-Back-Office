"use client";

import { createClient } from "@/lib/supabase/client";
import { orderBetween } from "@/lib/order";
import type { Captacao, Decisao, Status } from "@/types";

/** Encaminhamento padrão do fluxo: aprovada agenda visita, reprovada vai para negativa. */
export function destinoDecisao(decisao: Decisao): Status {
  return decisao === "aprovada" ? "pendente_agendar_visita" : "pendente_negativa";
}

/**
 * Trava de segurança única para todos os pontos de decisão (desktop, barra
 * mobile e card do quadro): reprovar uma captação que já virou imóvel no
 * back-office pede confirmação explícita.
 */
export function confirmarDecisao(captacao: Captacao, decisao: Decisao): boolean {
  if (decisao === "reprovada" && captacao.decisao === "aprovada" && captacao.imovel_codigo) {
    return window.confirm(
      `Esta captação já foi cadastrada como imóvel ${captacao.imovel_codigo}. ` +
        "Reprovar aqui não remove o imóvel do sistema, só muda o status da captação. Continuar?"
    );
  }
  return true;
}

/** Ordem para entrar no FIM da coluna destino (consulta o maior `ordem` atual). */
export async function ordemFimDaColuna(status: Status): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from("captacao")
    .select("ordem")
    .eq("status", status)
    .is("excluido_em", null)
    .order("ordem", { ascending: false })
    .limit(1);
  return orderBetween(data?.[0]?.ordem ?? null, null);
}

/**
 * Decide a captação a partir do detalhe (sem o store do quadro):
 * confirmação + ordem no fim da coluna + RPC atômica.
 */
export async function decidirCaptacao(
  captacao: Captacao,
  decisao: Decisao
): Promise<"ok" | "cancelado" | "erro"> {
  if (!confirmarDecisao(captacao, decisao)) return "cancelado";
  const destino = destinoDecisao(decisao);
  const ordem = await ordemFimDaColuna(destino);
  const supabase = createClient();
  const { error } = await supabase.rpc("mover_cartao", {
    p_captacao_id: captacao.id,
    p_para_status: destino,
    p_ordem: ordem,
    p_decisao: decisao,
  });
  return error ? "erro" : "ok";
}
