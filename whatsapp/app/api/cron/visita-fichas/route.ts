import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFichaVisitaJob } from "@/services/ficha-visita.service";

/** Cron de hora em hora: para cada visita agendada que começa dentro da próxima
 * hora e meia, gera a ficha de visita na API principal e entrega o link — ao
 * cliente quando a janela de 24h permite, senão pro número de plantão. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runFichaVisitaJob();
  return Response.json(result);
}
