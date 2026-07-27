/** Tempo de espera em formato humano curto: "há 3h", "há 2 dias". */
export function formatWaitTime(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 60) return `há ${Math.max(minutes, 1)}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

/** Horas decorridas desde a data — usado para escolher a cor de urgência. */
export function hoursSince(dateIso: string): number {
  return (Date.now() - new Date(dateIso).getTime()) / 3_600_000;
}
