import { afterEach, describe, it, expect, vi } from "vitest";
import { cloudApiWhatsAppProvider } from "@/services/whatsapp/providers/cloud-api";
import { whatsappProvider } from "@/services/whatsapp";
import {
  ECHO_CREATED_BY,
  processEchoMessage,
  processIncomingMessage,
} from "@/services/whatsapp.service";
import { runDailySummaryJob } from "@/services/jobs.service";
import { dataSource } from "@/services/data";

/**
 * Cobertura do modo coexistência (mesmo número no app WhatsApp Business e na
 * Cloud API): echo de mensagens enviadas pelo celular + envio de template
 * (único formato aceito fora da janela de 24h).
 */

describe("cloud-api: parse de smb_message_echoes", () => {
  function echoPayload(echo: Record<string, unknown>) {
    return JSON.stringify({
      entry: [
        {
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                metadata: { phone_number_id: "PHONE_ID" },
                message_echoes: [
                  { from: "5583999990000", to: "5511999998888", timestamp: "1700000000", ...echo },
                ],
              },
            },
          ],
        },
      ],
    });
  }

  it("echo de texto vira evento echo apontando pro cliente (to)", () => {
    const [event] = cloudApiWhatsAppProvider.parseWebhookPayload(
      echoPayload({ id: "wamid.echo1", type: "text", text: { body: "Respondi pelo celular" } }),
    );
    expect(event.type).toBe("echo");
    if (event.type !== "echo") return;
    expect(event.data.toPhone).toBe("5511999998888");
    expect(event.data.body).toBe("Respondi pelo celular");
    expect(event.data.waMessageId).toBe("wamid.echo1");
    expect(event.data.media).toBeNull();
  });

  it("echo de imagem carrega a referência de mídia", () => {
    const [event] = cloudApiWhatsAppProvider.parseWebhookPayload(
      echoPayload({
        id: "wamid.echo2",
        type: "image",
        image: { id: "MEDIA_9", mime_type: "image/jpeg", caption: "Planta baixa" },
      }),
    );
    if (event.type !== "echo") throw new Error("esperava echo");
    expect(event.data.messageType).toBe("image");
    expect(event.data.body).toBe("Planta baixa");
    expect(event.data.media?.metaMediaId).toBe("MEDIA_9");
  });

  it("payload comum de messages continua virando evento message", () => {
    const [event] = cloudApiWhatsAppProvider.parseWebhookPayload(
      JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: "wamid.in",
                      from: "5511999998888",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "oi" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(event.type).toBe("message");
  });
});

describe("fluxo mock: echo espelha resposta dada pelo celular", () => {
  it("cria mensagem outbound e tira a conversa de aguardando_resposta", async () => {
    const phone = "5511955560001";

    // Cliente manda mensagem → conversa fica aguardando resposta.
    const [incoming] = whatsappProvider.parseWebhookPayload(
      JSON.stringify({ from: phone, body: "Tem visita amanhã?" }),
    );
    if (incoming.type !== "message") throw new Error("esperava mensagem");
    await processIncomingMessage(incoming.data);

    const contact = await dataSource.contacts.findByPhone(phone);
    let conv = await dataSource.whatsapp.getConversationByContactId(contact!.id);
    expect(conv?.status).toBe("aguardando_resposta");

    // Corretor responde pelo app do celular → echo chega no webhook.
    const [echo] = whatsappProvider.parseWebhookPayload(
      JSON.stringify({ from: phone, body: "Tem sim, às 10h!", echo: true }),
    );
    if (echo.type !== "echo") throw new Error("esperava echo");
    const created = await processEchoMessage(echo.data);

    expect(created.direction).toBe("outbound");
    expect(created.createdBy).toBe(ECHO_CREATED_BY);

    conv = await dataSource.whatsapp.getConversationByContactId(contact!.id);
    expect(conv?.status).toBe("respondida");
    expect(conv?.lastMessagePreview).toBe("Tem sim, às 10h!");
  });

  it("echo pra número desconhecido cria o contato e a conversa", async () => {
    const phone = "5511955560002";
    const created = await processEchoMessage({
      waMessageId: "wamid.novo-contato",
      toPhone: phone,
      body: "Olá! Vi seu interesse no apê.",
      messageType: "text",
      media: null,
      timestamp: new Date().toISOString(),
    });

    expect(created.direction).toBe("outbound");
    const contact = await dataSource.contacts.findByPhone(phone);
    expect(contact).not.toBeNull();
    const conv = await dataSource.whatsapp.getConversationByContactId(contact!.id);
    expect(conv?.lastMessageDirection).toBe("outbound");
  });

  it("echo repetido (mesmo wa_message_id) não duplica a mensagem", async () => {
    const echoData = {
      waMessageId: "wamid.dedupe-echo",
      toPhone: "5511955560003",
      body: "mensagem única",
      messageType: "text" as const,
      media: null,
      timestamp: new Date().toISOString(),
    };
    const first = await processEchoMessage(echoData);
    const second = await processEchoMessage(echoData);
    expect(second.id).toBe(first.id);
  });
});

describe("cloud-api: envio de template", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("monta o payload de template com os parâmetros do corpo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.tpl" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await cloudApiWhatsAppProvider.sendTemplateMessage({
      toPhone: "5583999990000",
      templateName: "alerta_central",
      languageCode: "pt_BR",
      bodyParams: ["Fulano aguardando há 2h"],
    });

    expect(result.providerMessageId).toBe("wamid.tpl");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("alerta_central");
    expect(body.template.language.code).toBe("pt_BR");
    expect(body.template.components[0].parameters).toEqual([
      { type: "text", text: "Fulano aguardando há 2h" },
    ]);
  });
});

describe("alertas: fallback de template fora da janela de 24h", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WHATSAPP_ALERT_TEMPLATE;
    delete process.env.ALERT_PHONE_NUMBER;
  });

  it("texto livre falhou → reenvia como template com o texto achatado", async () => {
    process.env.ALERT_PHONE_NUMBER = "5583999990000";
    process.env.WHATSAPP_ALERT_TEMPLATE = "alerta_central";

    vi.spyOn(whatsappProvider, "sendTextMessage").mockRejectedValue(
      new Error("(#131047) Re-engagement message"),
    );
    const templateSpy = vi
      .spyOn(whatsappProvider, "sendTemplateMessage")
      .mockResolvedValue({ providerMessageId: "wamid.fallback" });

    const result = await runDailySummaryJob();

    expect(result.sent).toBe(true);
    expect(templateSpy).toHaveBeenCalledTimes(1);
    const { bodyParams, templateName } = templateSpy.mock.calls[0][0];
    expect(templateName).toBe("alerta_central");
    // Parâmetro de template não pode ter quebra de linha (regra da Meta).
    expect(bodyParams[0]).not.toContain("\n");
    expect(bodyParams[0]).toContain("Resumo do dia — Morabilidade");
  });

  it("sem template configurado, a falha do texto livre se propaga", async () => {
    process.env.ALERT_PHONE_NUMBER = "5583999990000";

    vi.spyOn(whatsappProvider, "sendTextMessage").mockRejectedValue(new Error("fora da janela"));
    const templateSpy = vi.spyOn(whatsappProvider, "sendTemplateMessage");

    const result = await runDailySummaryJob();

    expect(result.sent).toBe(false);
    expect(templateSpy).not.toHaveBeenCalled();
  });
});
