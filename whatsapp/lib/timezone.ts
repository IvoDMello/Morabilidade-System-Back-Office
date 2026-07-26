const SAO_PAULO_UTC_OFFSET_HOURS = 3;

/**
 * Meia-noite de hoje em America/Sao_Paulo, como Date (instante UTC).
 * Usa offset fixo (UTC-3): o Brasil não observa horário de verão desde 2019.
 * Se isso voltar a mudar, trocar por um cálculo com Intl/timezone de verdade.
 */
export function startOfDaySaoPaulo(now: Date = new Date()): Date {
  const saoPauloLocal = new Date(now.getTime() - SAO_PAULO_UTC_OFFSET_HOURS * 3_600_000);
  saoPauloLocal.setUTCHours(0, 0, 0, 0);
  return new Date(saoPauloLocal.getTime() + SAO_PAULO_UTC_OFFSET_HOURS * 3_600_000);
}
