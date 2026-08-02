import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";
import { whatsappProvider } from "@/services/whatsapp";
import {
  extrairCodigoImovel,
  getPendingPhones,
  montarMensagemCliente,
  runFichaVisitaJob,
} from "@/services/ficha-visita.service";

/**
 * Ficha de visita automática (cron horário): geração na API principal + regra
 * de entrega (cliente com janela aberta → template → pendência do plantão).
 */

const CLIENTE_PHONE = "5511930001111";
const PLANTAO_PHONE = "5511940002222";
const PLANTAO_PHONE_2 = "5511940003333";

/** Resposta da API principal para os dois endpoints que o job consome. */
function stubBackofficeFetch(overrides: { imovelId?: string | null; falhaFicha?: string } = {}) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/imoveis/interno/")) {
      return new Response(
        JSON.stringify({
          id: overrides.imovelId === undefined ? "imovel-uuid-1" : overrides.imovelId,
          codigo: "MB-00033",
          titulo: "Apartamento Jardins",
          bairro: "Jardins",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/fichas-visita")) {
      if (overrides.falhaFicha) {
        return new Response(JSON.stringify({ detail: overrides.falhaFicha }), { status: 400 });
      }
      return new Response(
        JSON.stringify({
          id: "ficha-uuid-1",
          token: "tok123",
          imovel_codigo: "MB-00033",
          imovel_endereco: "Rua das Flores, 100",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`URL inesperada no teste: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Cria contato + visita daqui a ~1h, do jeito que o cron espera encontrar. */
async function criarVisita(options: { imovelCodigo?: string | null; title?: string } = {}) {
  const contact = await dataSource.contacts.create({
    name: "Joana Ribeiro",
    phone: CLIENTE_PHONE,
    category: "cliente",
  } as never);
  // O vínculo com o corretor logado é o que dá o corretor_id da ficha.
  mockStore.corretores[0] = { ...mockStore.corretores[0], authUserId: "auth-user-1" };

  const reminder = await dataSource.reminders.create({
    contactId: contact.id,
    title: options.title ?? "Visita — MB-00033",
    reminderAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdBy: "Teste",
    corretorId: mockStore.corretores[0].id,
    imovelCodigo: options.imovelCodigo === undefined ? "MB-00033" : options.imovelCodigo,
  });
  return { contact, reminder };
}

describe("helpers da ficha de visita", () => {
  it("extrai o código do imóvel do título do lembrete", () => {
    expect(extrairCodigoImovel("Visita — MB-00033")).toBe("MB-00033");
    expect(extrairCodigoImovel("visita mb-123")).toBe("MB-123");
    expect(extrairCodigoImovel("Ligar para o cliente")).toBeNull();
  });

  it("lê um ou dois números de plantão, só dígitos", () => {
    vi.stubEnv("PENDING_PHONE_NUMBERS", "5511940002222");
    expect(getPendingPhones()).toEqual(["5511940002222"]);

    vi.stubEnv("PENDING_PHONE_NUMBERS", "+55 (11) 94000-2222, 5511940003333");
    expect(getPendingPhones()).toEqual(["5511940002222", "5511940003333"]);
  });

  it("cai no número de alertas quando não há números de plantão", () => {
    vi.stubEnv("PENDING_PHONE_NUMBERS", "");
    vi.stubEnv("ALERT_PHONE_NUMBER", "5511999990000");
    expect(getPendingPhones()).toEqual(["5511999990000"]);
  });

  it("mensagem do cliente traz primeiro nome, hora e link", () => {
    const texto = montarMensagemCliente({
      contactName: "Joana Ribeiro",
      hora: "15:00",
      endereco: "Rua das Flores, 100",
      link: "https://morabilidade.com/ficha/tok123",
    });
    expect(texto).toContain("Joana");
    expect(texto).not.toContain("Ribeiro");
    expect(texto).toContain("15:00");
    expect(texto).toContain("Rua das Flores, 100");
    expect(texto).toContain("https://morabilidade.com/ficha/tok123");
  });
});

describe("cron da ficha de visita", () => {
  beforeEach(() => {
    mockStore.reminders = [];
    mockStore.contacts = [];
    vi.stubEnv("BACKOFFICE_API_URL", "https://api.example.com");
    vi.stubEnv("BACKOFFICE_INTERNAL_TOKEN", "token-interno");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://morabilidade.com");
    vi.stubEnv("PENDING_PHONE_NUMBERS", PLANTAO_PHONE);
    vi.stubEnv("WHATSAPP_FICHA_TEMPLATE", "");
    vi.stubEnv("WHATSAPP_ALERT_TEMPLATE", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("janela aberta: gera a ficha e manda o link direto pro cliente", async () => {
    stubBackofficeFetch();
    const enviar = vi.spyOn(whatsappProvider, "sendTextMessage");
    const { reminder } = await criarVisita();

    const resultado = await runFichaVisitaJob();

    expect(resultado).toMatchObject({ total: 1, paraCliente: 1, paraPlantao: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].toPhone).toBe(CLIENTE_PHONE);
    expect(enviar.mock.calls[0][0].body).toContain("https://morabilidade.com/ficha/tok123");

    const [salvo] = await dataSource.reminders.listByContact(reminder.contactId);
    expect(salvo.fichaVisitaId).toBe("ficha-uuid-1");
    expect(salvo.fichaNotificadaEm).not.toBeNull();
  });

  it("janela fechada e sem template: manda a pendência com o link pro plantão", async () => {
    stubBackofficeFetch();
    const enviar = vi
      .spyOn(whatsappProvider, "sendTextMessage")
      .mockImplementationOnce(async () => {
        throw new Error("fora da janela de 24h");
      })
      .mockImplementation(async () => ({ providerMessageId: "ok" }));
    await criarVisita();

    const resultado = await runFichaVisitaJob();

    expect(resultado).toMatchObject({ total: 1, paraCliente: 0, paraPlantao: 1 });
    const paraPlantao = enviar.mock.calls[1][0];
    expect(paraPlantao.toPhone).toBe(PLANTAO_PHONE);
    expect(paraPlantao.body).toContain("https://morabilidade.com/ficha/tok123");
    expect(paraPlantao.body).toContain("encaminhar o link");
  });

  it("janela fechada com template aprovado: entrega ao cliente pelo template", async () => {
    vi.stubEnv("WHATSAPP_FICHA_TEMPLATE", "lembrete_ficha_visita");
    stubBackofficeFetch();
    vi.spyOn(whatsappProvider, "sendTextMessage").mockImplementation(async () => {
      throw new Error("fora da janela de 24h");
    });
    const template = vi
      .spyOn(whatsappProvider, "sendTemplateMessage")
      .mockResolvedValue({ providerMessageId: "tmpl-1" });
    await criarVisita();

    const resultado = await runFichaVisitaJob();

    expect(resultado).toMatchObject({ paraCliente: 1, paraPlantao: 0 });
    expect(template).toHaveBeenCalledTimes(1);
    const args = template.mock.calls[0][0];
    expect(args.toPhone).toBe(CLIENTE_PHONE);
    expect(args.bodyParams[1]).toBe("https://morabilidade.com/ficha/tok123");
  });

  it("visita sem imóvel: vai pro plantão com o motivo, sem chamar a API", async () => {
    const fetchMock = stubBackofficeFetch();
    const enviar = vi.spyOn(whatsappProvider, "sendTextMessage");
    await criarVisita({ imovelCodigo: null, title: "Visita com a Joana" });

    const resultado = await runFichaVisitaJob();

    expect(resultado).toMatchObject({ total: 1, paraCliente: 0, paraPlantao: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enviar.mock.calls[0][0].body).toContain("sem imóvel vinculado");
  });

  it("API recusa a ficha: o motivo dela vira a pendência do plantão", async () => {
    stubBackofficeFetch({ falhaFicha: "O corretor responsável não tem CRECI cadastrado." });
    const enviar = vi.spyOn(whatsappProvider, "sendTextMessage");
    await criarVisita();

    const resultado = await runFichaVisitaJob();

    expect(resultado).toMatchObject({ paraPlantao: 1 });
    expect(enviar.mock.calls[0][0].body).toContain("CRECI");
  });

  it("dois números de plantão recebem a mesma pendência", async () => {
    vi.stubEnv("PENDING_PHONE_NUMBERS", `${PLANTAO_PHONE},${PLANTAO_PHONE_2}`);
    stubBackofficeFetch({ imovelId: null });
    const enviar = vi.spyOn(whatsappProvider, "sendTextMessage");
    await criarVisita();

    await runFichaVisitaJob();

    const destinos = enviar.mock.calls.map((c) => c[0].toPhone);
    expect(destinos).toEqual([PLANTAO_PHONE, PLANTAO_PHONE_2]);
  });

  it("não reenvia na rodada seguinte (dedupe por ficha_notificada_em)", async () => {
    stubBackofficeFetch();
    const enviar = vi.spyOn(whatsappProvider, "sendTextMessage");
    await criarVisita();

    await runFichaVisitaJob();
    const segunda = await runFichaVisitaJob();

    expect(segunda.total).toBe(0);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("visita que já tem ficha não gera uma segunda (documento jurídico)", async () => {
    const fetchMock = stubBackofficeFetch();
    const enviar = vi.spyOn(whatsappProvider, "sendTextMessage");
    const { reminder } = await criarVisita();
    // Simula o reenvio manual: ficha já emitida, marca de notificação limpa.
    await dataSource.reminders.update(reminder.id, { fichaVisitaId: "ficha-uuid-antiga" });

    const resultado = await runFichaVisitaJob();

    expect(resultado).toMatchObject({ paraCliente: 0, paraPlantao: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(enviar.mock.calls[0][0].body).toContain("já existe ficha gerada");
  });

  it("ignora visitas fora da janela de 90 minutos", async () => {
    stubBackofficeFetch();
    const { contact } = await criarVisita();
    await dataSource.reminders.create({
      contactId: contact.id,
      title: "Visita — MB-00099",
      reminderAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      createdBy: "Teste",
      imovelCodigo: "MB-00099",
    });

    const resultado = await runFichaVisitaJob();

    expect(resultado.total).toBe(1);
  });
});
