import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runDailySummaryJob } from "@/services/jobs.service";

/** Cron diário às 18h America/Sao_Paulo (Fase 4): resumo do dia pro meu WhatsApp.
 * Resposta traz o texto gerado (summaryText), útil pra disparo manual/teste. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runDailySummaryJob();
  return Response.json(result);
}
