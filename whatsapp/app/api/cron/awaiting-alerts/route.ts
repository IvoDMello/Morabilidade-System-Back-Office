import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runAwaitingAlertJob, runTriagemJob } from "@/services/jobs.service";

/** Cron de hora em hora (Fase 3): alerta via WhatsApp pra mim quando uma conversa
 * espera resposta há mais de 2h (no máximo 1 alerta por dia por conversa).
 *
 * Na mesma passada roda a triagem da IA sobre a fila de aguardando (migration
 * 0026), que alimenta a aba "Precisa responder". As duas leem a mesma fila e
 * respondem à mesma pergunta — "quem está no vácuo?" —, então economizam uma
 * ida ao banco andando juntas. Independentes no resultado: a triagem falhar
 * não pode custar o alerta. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [alertas, triagem] = await Promise.all([runAwaitingAlertJob(), runTriagemJob()]);
  return Response.json({ ...alertas, triagem });
}
