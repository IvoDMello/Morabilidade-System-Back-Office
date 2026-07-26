import { revalidatePath } from "next/cache";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFollowUpCooldownJob } from "@/services/jobs.service";

/** Cron de hora em hora (Fase 3): respondida esfriada (3+ dias sem o cliente responder) vira follow_up_sugerido. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runFollowUpCooldownJob();
  revalidatePath("/pendencias");

  return Response.json(result);
}
