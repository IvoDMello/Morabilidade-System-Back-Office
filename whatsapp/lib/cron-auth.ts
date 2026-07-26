/**
 * Autentica requisições de cron (Vercel Cron envia automaticamente
 * `Authorization: Bearer $CRON_SECRET` quando essa env var está configurada
 * no projeto). Mesmo header serve pra gatilho externo (GitHub Actions,
 * cron-job.org) se um dia o cron nativo não for suficiente.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
