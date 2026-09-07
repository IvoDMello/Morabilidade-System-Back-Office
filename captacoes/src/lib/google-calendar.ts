import "server-only";

/**
 * Espelho dos agendamentos na Google Agenda da Morabilidade.
 *
 * Mesma abordagem já em produção no app de atendimento
 * (whatsapp/services/google-calendar.service.ts): OAuth feito UMA vez numa
 * conta única da empresa, com o refresh token nas variáveis de ambiente. Não
 * há login de Google por pessoa — de propósito.
 *
 * Aqui a chamada é REST direta com `fetch`, sem o SDK `googleapis`: são três
 * endpoints, e uma dependência a menos no servidor.
 *
 * TUDO É BEST-EFFORT. Sem credenciais, ou se a API falhar, o agendamento
 * continua salvo no app — só não aparece na Agenda. Nunca bloquear o fluxo
 * por causa do calendário.
 */

const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN } =
  process.env;

const FUSO = "America/Sao_Paulo";
const CALENDAR_ID = "primary";
const BASE = "https://www.googleapis.com/calendar/v3";

export function calendarioConfigurado(): boolean {
  return Boolean(
    GOOGLE_CALENDAR_CLIENT_ID && GOOGLE_CALENDAR_CLIENT_SECRET && GOOGLE_CALENDAR_REFRESH_TOKEN
  );
}

/** Troca o refresh token por um access token de curta duração. */
async function accessToken(): Promise<string | null> {
  if (!calendarioConfigurado()) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: GOOGLE_CALENDAR_CLIENT_SECRET!,
        refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[google-calendar] refresh token recusado", res.status);
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (err) {
    console.error("[google-calendar] falha ao obter access token", err);
    return null;
  }
}

export interface EventoInput {
  titulo: string;
  descricao: string;
  /** ISO com fuso. */
  inicio: string;
  fim: string;
}

/**
 * Cria (ou atualiza, se `eventIdExistente` for passado) o evento.
 * Devolve o id do evento, guardado na captação para permitir apagá-lo depois.
 * `null` = não foi criado; o chamador segue em frente mesmo assim.
 */
export async function salvarEvento(
  input: EventoInput,
  eventIdExistente?: string | null
): Promise<string | null> {
  const token = await accessToken();
  if (!token) return null;

  const body = {
    summary: input.titulo,
    description: input.descricao,
    start: { dateTime: input.inicio, timeZone: FUSO },
    end: { dateTime: input.fim, timeZone: FUSO },
  };

  const url = eventIdExistente
    ? `${BASE}/calendars/${CALENDAR_ID}/events/${encodeURIComponent(eventIdExistente)}`
    : `${BASE}/calendars/${CALENDAR_ID}/events`;

  try {
    const res = await fetch(url, {
      method: eventIdExistente ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // Evento apagado à mão na Agenda: recria em vez de falhar.
    if (res.status === 404 && eventIdExistente) return salvarEvento(input, null);

    if (!res.ok) {
      console.error("[google-calendar] falha ao salvar evento", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { id?: string };
    return json.id ?? null;
  } catch (err) {
    console.error("[google-calendar] erro de rede ao salvar evento", err);
    return null;
  }
}

/** Apaga o evento espelhado quando o agendamento é desfeito. Best-effort. */
export async function apagarEvento(eventId: string): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  try {
    const res = await fetch(
      `${BASE}/calendars/${CALENDAR_ID}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    // 404/410: já não existe — para o nosso lado, é sucesso.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error("[google-calendar] falha ao apagar evento", res.status);
    }
  } catch (err) {
    console.error("[google-calendar] erro de rede ao apagar evento", err);
  }
}
