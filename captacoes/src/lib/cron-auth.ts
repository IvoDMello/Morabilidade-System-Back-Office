import { timingSafeEqual } from "node:crypto";

/**
 * Autentica as chamadas de cron. O Vercel Cron manda
 * `Authorization: Bearer $CRON_SECRET` quando a variável existe no projeto.
 *
 * Sem CRON_SECRET configurado, recusa tudo. Comparar direto com
 * `Bearer ${process.env.CRON_SECRET}` aceitaria "Bearer undefined" de qualquer
 * um quando a variável faltasse.
 */
export function cronAutorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const recebido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
