import { google } from "googleapis";

const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN } = process.env;

const FUSO_VISITA = "America/Sao_Paulo";
const DURACAO_VISITA_MINUTOS = 60;

function getCalendarClient() {
  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_REFRESH_TOKEN) {
    return null;
  }
  const auth = new google.auth.OAuth2(GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
}

interface CriarEventoVisitaInput {
  contactName: string;
  contactPhone: string;
  when: Date;
  imovelCodigo?: string | null;
  observacao?: string | null;
}

/**
 * Espelha no Google Agenda (evento com horário real de início/fim) a visita
 * que o assistente agenda, na conta ligada via GOOGLE_CALENDAR_CLIENT_ID/
 * SECRET/REFRESH_TOKEN (OAuth autorizado uma vez, escopo calendar.events).
 * Best-effort: sem as credenciais configuradas, ou se a API falhar, a visita
 * continua criada normalmente no CRM — só não aparece na Agenda da conta.
 * Retorna o ID do evento criado (guardado no lembrete) para permitir apagar
 * o evento depois; null se não foi criado.
 */
export async function criarEventoDeVisita(input: CriarEventoVisitaInput): Promise<string | null> {
  const calendar = getCalendarClient();
  if (!calendar) return null;

  const titulo = input.imovelCodigo ? `Visita — ${input.imovelCodigo}` : "Visita";
  const descricao = [`Contato: ${input.contactName} (${input.contactPhone})`, input.observacao ? `Obs: ${input.observacao}` : null]
    .filter(Boolean)
    .join("\n");

  const fim = new Date(input.when.getTime() + DURACAO_VISITA_MINUTOS * 60 * 1000);

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: titulo,
        description: descricao,
        start: { dateTime: input.when.toISOString(), timeZone: FUSO_VISITA },
        end: { dateTime: fim.toISOString(), timeZone: FUSO_VISITA },
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[google-calendar] falha ao criar evento da visita", err);
    return null;
  }
}

/**
 * Apaga o evento espelhado quando o lembrete correspondente é excluído do
 * CRM. Best-effort: sem credenciais, evento já removido manualmente, ou
 * falha na API, não impede a exclusão do lembrete — só loga o problema.
 */
export async function apagarEventoDeVisita(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  if (!calendar) return;

  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    console.error("[google-calendar] falha ao apagar evento da visita", err);
  }
}
