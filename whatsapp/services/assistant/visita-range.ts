import { VISITA_RANGE } from "./tools";

// Módulo puro (sem imports de servidor/serviço) para ser testável isoladamente:
// aqui mora a trava de horário da visita agendada pelo assistente — a validação
// é do SISTEMA, nunca do modelo de IA.

const SAO_PAULO_UTC_OFFSET_HOURS = 3;

/** Erro de validação de uma ação (mensagem amigável para mostrar ao operador). */
export class AcaoInvalidaError extends Error {}

/**
 * Interpreta "YYYY-MM-DDTHH:mm" como horário local de São Paulo (UTC-3) e
 * devolve o instante UTC + os componentes locais (para validar hora e dia).
 * Rejeita formatos que não sejam exatamente esse (o modelo às vezes inventa).
 */
export function parseSaoPauloLocal(local: string): { utc: Date; hora: number; diaSemana: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) {
    throw new AcaoInvalidaError(
      "Data/hora em formato inválido. Reformule a visita com uma data e hora claras.",
    );
  }
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  // Instante UTC do horário local SP: local + 3h.
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) + SAO_PAULO_UTC_OFFSET_HOURS * 3_600_000;
  const utc = new Date(utcMs);
  if (Number.isNaN(utc.getTime())) {
    throw new AcaoInvalidaError("Data/hora inválida.");
  }
  // Dia da semana no horário LOCAL (0 = domingo).
  const diaSemana = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return { utc, hora: h, diaSemana };
}

/**
 * Valida o horário da visita contra o range permitido — ESTA é a trava, no
 * servidor, não no modelo. Lança AcaoInvalidaError com motivo legível.
 */
export function validarHorarioVisita(dataHoraLocal: string, agora: Date = new Date()): Date {
  const { utc, hora, diaSemana } = parseSaoPauloLocal(dataHoraLocal);

  if (utc.getTime() <= agora.getTime()) {
    throw new AcaoInvalidaError("A visita precisa ser em uma data/hora futura.");
  }
  const limite = new Date(agora.getTime() + VISITA_RANGE.diasAdiante * 24 * 3_600_000);
  if (utc.getTime() > limite.getTime()) {
    throw new AcaoInvalidaError(`A visita não pode ser marcada para mais de ${VISITA_RANGE.diasAdiante} dias à frente.`);
  }
  if (hora < VISITA_RANGE.horaMin || hora >= VISITA_RANGE.horaMax) {
    throw new AcaoInvalidaError(
      `Fora do horário de visitas (${VISITA_RANGE.horaMin}h às ${VISITA_RANGE.horaMax}h).`,
    );
  }
  if (!VISITA_RANGE.permiteDomingo && diaSemana === 0) {
    throw new AcaoInvalidaError("Não agendamos visitas aos domingos.");
  }
  return utc;
}
