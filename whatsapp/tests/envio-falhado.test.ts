import { beforeEach, describe, expect, it, vi } from "vitest";
import { dataSource } from "@/services/data";
import { mockStore } from "@/services/data/mock/store";
import {
  getFailedOutbound,
  processStatusUpdate,
  registerOutboundMessage,
} from "@/services/whatsapp.service";
import { runAwaitingAlertJob } from "@/services/jobs.service";
import type { WhatsAppMessageStatus } from "@/constants/whatsapp-message-status";

/**
 * Mensagens perdidas no sentido SAÍDA: nós mandamos, a Meta recusou, e o
 * cliente nunca recebeu.
 *
 * O modo de falha que estes testes travam: a mensagem era gravada como `sent`
 * no instante do envio, o trigger punha a conversa em `respondida`, e o
 * `failed` chegava depois sem mexer na conversa. Falhar no envio deixava o
 * sistema num estado MELHOR do que não ter respondido — a pendência sumia.
 */

const CONTATO_ID = "contato-falha";
const CONVERSA_ID = "conversa-falha";

function agoraMenos(minutos: number): string {
  return new Date(Date.now() - minutos * 60 * 1000).toISOString();
}

/** Atualização de status como o webhook da Meta entrega. */
function statusDaMeta(
  waMessageId: string,
  status: WhatsAppMessageStatus,
  errorMessage?: string,
) {
  return processStatusUpdate({
    waMessageId,
    status,
    errorMessage: errorMessage ?? null,
    timestamp: new Date().toISOString(),
  });
}

/** Conversa que recebeu uma mensagem do cliente e foi "respondida" por um envio. */
async function montarConversaRespondida() {
  mockStore.contacts.push({
    id: CONTATO_ID,
    name: "Marina Alves",
    phone: "5521970005555",
    email: null,
    category: "comprador",
    status: "novo",
    nextAction: "ligar",
    isFavorite: false,
    isBlocked: false,
    lossReason: null,
    lossReasonNote: null,
    generalNotes: null,
    aiSummary: null,
    aiSummaryGeneratedAt: null,
    clienteId: null,
    clienteCodigo: null,
    corretorId: null,
    createdAt: agoraMenos(120),
    updatedAt: agoraMenos(120),
  });

  mockStore.conversations.push({
    id: CONVERSA_ID,
    contactId: CONTATO_ID,
    waPhoneNumber: "5521970005555",
    lastMessageAt: agoraMenos(10),
    lastMessagePreview: "Claro, pode ser",
    lastMessageDirection: "outbound",
    unreadCount: 0,
    status: "respondida",
    lastInboundAt: agoraMenos(30),
    lastOutboundAt: agoraMenos(10),
    statusChangedAt: agoraMenos(10),
    followUpSnoozedUntil: null,
    lastAlertAt: null,
    pinnedAt: null,
    triagemPrecisaResposta: null,
    triagemMotivo: null,
    triagemMensagemEm: null,
    createdAt: agoraMenos(120),
    updatedAt: agoraMenos(10),
  });

  // Mensagem do cliente, e depois a nossa resposta (que vai falhar).
  await dataSource.whatsapp.createMessage({
    conversationId: CONVERSA_ID,
    waMessageId: "wamid.cliente",
    direction: "inbound",
    body: "Consegue me mandar as fotos?",
    status: "received",
    waTimestamp: agoraMenos(30),
  });

  const nossa = await registerOutboundMessage({
    conversationId: CONVERSA_ID,
    body: "Claro, pode ser",
    providerMessageId: "wamid.nossa",
    createdBy: "Leandro",
  });

  return nossa;
}

beforeEach(() => {
  mockStore.contacts.length = 0;
  mockStore.conversations.length = 0;
  mockStore.messages.length = 0;
});

describe("envio que falha volta para a fila", () => {
  it("reabre a conversa como aguardando resposta", async () => {
    await montarConversaRespondida();
    expect((await dataSource.whatsapp.getConversationById(CONVERSA_ID))?.status).toBe("respondida");

    await statusDaMeta("wamid.nossa", "failed", "Message failed to send because more than 24 hours have passed");

    const conversa = await dataSource.whatsapp.getConversationById(CONVERSA_ID);
    expect(conversa?.status).toBe("aguardando_resposta");
  });

  it("um status de sucesso não mexe na conversa", async () => {
    await montarConversaRespondida();

    await statusDaMeta("wamid.nossa", "delivered");

    expect((await dataSource.whatsapp.getConversationById(CONVERSA_ID))?.status).toBe("respondida");
  });

  it("não reabre se outro envio posterior foi entregue", async () => {
    await montarConversaRespondida();
    // Segunda tentativa, essa deu certo.
    await registerOutboundMessage({
      conversationId: CONVERSA_ID,
      body: "Segue as fotos",
      providerMessageId: "wamid.nossa2",
      createdBy: "Leandro",
    });

    await statusDaMeta("wamid.nossa", "failed");

    // O cliente foi respondido de verdade — a pendência não é real.
    expect((await dataSource.whatsapp.getConversationById(CONVERSA_ID))?.status).toBe("respondida");
  });

  it("não desfaz um encerramento manual", async () => {
    await montarConversaRespondida();
    await dataSource.whatsapp.closeConversation(CONVERSA_ID);

    await statusDaMeta("wamid.nossa", "failed");

    // Encerrar foi decisão de gente; falha de entrega não a desfaz.
    expect((await dataSource.whatsapp.getConversationById(CONVERSA_ID))?.status).toBe("encerrada");
  });

  it("status de mensagem desconhecida não quebra o webhook", async () => {
    await expect(
      statusDaMeta("wamid.que-nao-existe", "failed"),
    ).resolves.toBeNull();
  });
});

describe("fila de envios não entregues", () => {
  it("lista a falha com o motivo que a Meta devolveu", async () => {
    await montarConversaRespondida();
    await statusDaMeta("wamid.nossa", "failed", "Re-engagement message");

    const falhas = await getFailedOutbound();
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatchObject({
      contactName: "Marina Alves",
      body: "Claro, pode ser",
      // O motivo já era gravado no banco e não aparecia em lugar nenhum da UI.
      errorMessage: "Re-engagement message",
      contactId: CONTATO_ID,
    });
  });

  it("não lista envios que deram certo", async () => {
    await montarConversaRespondida();
    await statusDaMeta("wamid.nossa", "delivered");

    expect(await getFailedOutbound()).toHaveLength(0);
  });

  it("ignora falha mais velha que a janela de 7 dias", async () => {
    await montarConversaRespondida();
    await statusDaMeta("wamid.nossa", "failed");

    // Empurra a mensagem para 10 dias atrás: vira histórico, não pendência.
    const msg = mockStore.messages.find((m) => m.waMessageId === "wamid.nossa")!;
    msg.waTimestamp = agoraMenos(10 * 24 * 60);

    expect(await getFailedOutbound()).toHaveLength(0);
  });
});

describe("alerta de conversa aguardando", () => {
  it("alerta que falhou é retentado na próxima rodada", async () => {
    process.env.ALERT_PHONE_NUMBER = "5521999998888";
    delete process.env.WHATSAPP_ALERT_TEMPLATE;

    await montarConversaRespondida();
    // Conversa esperando resposta há mais de 2h, nunca alertada.
    const conversa = mockStore.conversations.find((c) => c.id === CONVERSA_ID)!;
    conversa.status = "aguardando_resposta";
    conversa.lastInboundAt = agoraMenos(200);
    conversa.lastAlertAt = null;

    const provider = await import("@/services/whatsapp");
    const envio = vi
      .spyOn(provider.whatsappProvider, "sendTextMessage")
      .mockRejectedValueOnce(new Error("canal fora do ar"));

    const resultado = await runAwaitingAlertJob();
    expect(resultado.failed).toBe(1);

    // `markAlerted` estava num `finally`: o alerta que falhou contava como
    // enviado e a conversa saía do filtro até o dia seguinte.
    expect(
      mockStore.conversations.find((c) => c.id === CONVERSA_ID)?.lastAlertAt,
    ).toBeNull();

    envio.mockRestore();
  });

  it("alerta entregue marca a conversa e não repete no mesmo dia", async () => {
    process.env.ALERT_PHONE_NUMBER = "5521999998888";

    await montarConversaRespondida();
    const conversa = mockStore.conversations.find((c) => c.id === CONVERSA_ID)!;
    conversa.status = "aguardando_resposta";
    conversa.lastInboundAt = agoraMenos(200);
    conversa.lastAlertAt = null;

    const resultado = await runAwaitingAlertJob();
    expect(resultado.sent).toBe(1);
    expect(
      mockStore.conversations.find((c) => c.id === CONVERSA_ID)?.lastAlertAt,
    ).not.toBeNull();
  });
});
