import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Espelho na Google Agenda: tudo é best-effort. Sem credenciais ou com a API
 * fora, devolve null/nada e o agendamento segue salvo no app.
 */

type Rota = (url: string, init: RequestInit) => Response | Promise<Response>;

const fetchFalso = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

async function carregar(configurado = true) {
  vi.resetModules();
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", configurado ? "cid" : "");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", configurado ? "segredo" : "");
  vi.stubEnv("GOOGLE_CALENDAR_REFRESH_TOKEN", configurado ? "refresh" : "");
  return import("./google-calendar");
}

function rotas(...respostas: Rota[]) {
  for (const r of respostas) fetchFalso.mockImplementationOnce(async (url, init) => r(url, init));
}

const token: Rota = () => Response.json({ access_token: "at-1" });
const EVENTO = { titulo: "Visita MB-42", descricao: "Leblon", inicio: "2026-11-10T10:00:00-03:00", fim: "2026-11-10T11:00:00-03:00" };

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sem credenciais", () => {
  it("não chama o Google e devolve null", async () => {
    const gc = await carregar(false);
    expect(gc.calendarioConfigurado()).toBe(false);
    expect(await gc.salvarEvento(EVENTO)).toBeNull();
    await gc.apagarEvento("ev-1");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("salvarEvento", () => {
  it("troca o refresh token e cria o evento no fuso de São Paulo", async () => {
    const gc = await carregar();
    rotas(token, () => Response.json({ id: "ev-9" }));

    expect(await gc.salvarEvento(EVENTO)).toBe("ev-9");

    const [urlToken, initToken] = fetchFalso.mock.calls[0];
    expect(urlToken).toBe("https://oauth2.googleapis.com/token");
    expect(String(initToken.body)).toContain("grant_type=refresh_token");
    const [url, init] = fetchFalso.mock.calls[1];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer at-1" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      summary: "Visita MB-42",
      start: { dateTime: EVENTO.inicio, timeZone: "America/Sao_Paulo" },
    });
  });

  it("com id existente atualiza (PATCH) e recria se o evento sumiu da Agenda", async () => {
    const gc = await carregar();
    rotas(token, () => new Response(null, { status: 404 }), token, () => Response.json({ id: "ev-novo" }));

    expect(await gc.salvarEvento(EVENTO, "ev/1")).toBe("ev-novo");
    expect(fetchFalso.mock.calls[1][0]).toMatch(/events\/ev%2F1$/);
    expect(fetchFalso.mock.calls[1][1].method).toBe("PATCH");
    expect(fetchFalso.mock.calls[3][1].method).toBe("POST");
  });

  it("refresh recusado, erro da API, resposta sem id ou rede fora devolvem null", async () => {
    const gc = await carregar();
    rotas(() => new Response(null, { status: 400 }));
    expect(await gc.salvarEvento(EVENTO)).toBeNull();

    rotas(token, () => new Response("quota", { status: 403 }));
    expect(await gc.salvarEvento(EVENTO)).toBeNull();

    rotas(token, () => Response.json({}));
    expect(await gc.salvarEvento(EVENTO)).toBeNull();

    rotas(token, () => Promise.reject(new TypeError("offline")));
    expect(await gc.salvarEvento(EVENTO)).toBeNull();

    rotas(() => Promise.reject(new TypeError("offline")));
    expect(await gc.salvarEvento(EVENTO)).toBeNull();

    rotas(() => Response.json({}));
    expect(await gc.salvarEvento(EVENTO)).toBeNull();
  });
});

describe("apagarEvento", () => {
  it("apaga com DELETE; 404/410 contam como já apagado", async () => {
    const gc = await carregar();
    rotas(token, () => new Response(null, { status: 204 }));
    await gc.apagarEvento("ev-1");
    expect(fetchFalso.mock.calls[1][1].method).toBe("DELETE");

    for (const status of [404, 410]) {
      rotas(token, () => new Response(null, { status }));
      await gc.apagarEvento("ev-1");
    }
    expect(console.error).not.toHaveBeenCalled();
  });

  it("outros erros e falha de rede só vão para o log", async () => {
    const gc = await carregar();
    rotas(token, () => new Response(null, { status: 500 }));
    await gc.apagarEvento("ev-1");
    rotas(token, () => Promise.reject(new TypeError("offline")));
    await gc.apagarEvento("ev-1");
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
