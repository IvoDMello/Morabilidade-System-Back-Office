import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runAwaitingAlertJob } from "@/services/jobs.service";

/** Cron de hora em hora (Fase 3): alerta via WhatsApp pra mim quando uma conversa
 * espera resposta há mais de 2h (no máximo 1 alerta por dia por conversa). */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runAwaitingAlertJob();
  return Response.json(result);
}
