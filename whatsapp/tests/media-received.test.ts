import { describe, it, expect } from "vitest";
import { cloudApiWhatsAppProvider } from "@/services/whatsapp/providers/cloud-api";
import { whatsappProvider } from "@/services/whatsapp";
import { processIncomingMessage } from "@/services/whatsapp.service";
import { dataSource } from "@/services/data";
import { extFromMime, mediaLabel, messagePreview, mediaSrc } from "@/lib/whatsapp-media";

/**
 * Cobertura do suporte a mídia recebida (foto/áudio/vídeo/documento/figurinha):
 * parse do webhook da Meta, resolução no fluxo mock e helpers de exibição.
 */

describe("cloud-api: parse de mídia do webhook da Meta", () => {
  function metaPayload(message: Record<string, unknown>) {
    return JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "5511999998888", profile: { name: "Cliente" } }],
                messages: [{ from: "5511999998888", timestamp: "1700000000", ...message }],
              },
            },
          ],
        },
      ],
    });
  }

  it("imagem com legenda vira messageType image + referência de mídia", () => {
    const [event] = cloudApiWhatsAppProvider.parseWebhookPayload(
      metaPayload({
        id: "wamid.img",
        type: "image",
        image: { id: "MEDIA_123", mime_type: "image/jpeg", caption: "Fachada do imóvel" },
      }),
    );
    expect(event.type).toBe("message");
    if (event.type !== "message") return;
    expect(event.data.messageType).toBe("image");
    expect(event.data.body).toBe("Fachada do imóvel");
    expect(event.data.media).toEqual({
      metaMediaId: "MEDIA_123",
      mimeType: "image/jpeg",
      filename: null,
    });
  });

  it("documento preserva o nome do arquivo", () => {
    const [event] = cloudApiWhatsAppProvider.parseWebhookPayload(
      metaPayload({
        id: "wamid.doc",
        type: "document",
        document: { id: "MEDIA_DOC", mime_type: "application/pdf", filename: "contrato.pdf" },
      }),
    );
    if (event.type !== "message") return;
    expect(event.data.messageType).toBe("document");
    expect(event.data.media?.filename).toBe("contrato.pdf");
  });

  it("tipo desconhecido (localização) vira unsupported sem mídia", () => {
    const [event] = cloudApiWhatsAppProvider.parseWebhookPayload(
      metaPayload({ id: "wamid.loc", type: "location", location: { latitude: 0, longitude: 0 } }),
    );
    if (event.type !== "message") return;
    expect(event.data.messageType).toBe("unsupported");
    expect(event.data.media).toBeNull();
  });
});

describe("fluxo mock: mídia simulada é persistida e vira prévia", () => {
  it("imagem com legenda: guarda mediaUrl e usa a legenda como prévia", async () => {
    const phone = "5511955550001";
    const [event] = whatsappProvider.parseWebhookPayload(
      JSON.stringify({
        from: phone,
        body: "Olha essa foto",
        mediaUrl: "https://exemplo.com/foto.jpg",
        mediaType: "image",
      }),
    );
    if (event.type !== "message") throw new Error("esperava mensagem");
    const created = await processIncomingMessage(event.data);

    expect(created.messageType).toBe("image");
    expect(created.body).toBe("Olha essa foto");
    expect(created.mediaUrl).toBe("https://exemplo.com/foto.jpg");

    // A prévia da conversa (lista) reflete a legenda.
    const contact = await dataSource.contacts.findByPhone(phone);
    const conv = await dataSource.whatsapp.getConversationByContactId(contact!.id);
    expect(conv?.lastMessagePreview).toBe("Olha essa foto");
  });

  it("áudio sem legenda: prévia cai no rótulo da mídia", async () => {
    const phone = "5511955550002";
    const [event] = whatsappProvider.parseWebhookPayload(
      JSON.stringify({
        from: phone,
        body: "",
        mediaUrl: "https://exemplo.com/audio.ogg",
        mediaType: "audio",
      }),
    );
    if (event.type !== "message") throw new Error("esperava mensagem");
    const created = await processIncomingMessage(event.data);
    expect(created.messageType).toBe("audio");

    const contact = await dataSource.contacts.findByPhone(phone);
    const conv = await dataSource.whatsapp.getConversationByContactId(contact!.id);
    expect(conv?.lastMessagePreview).toBe("🎧 Áudio");
  });
});

describe("helpers de mídia", () => {
  it("messagePreview usa legenda ou rótulo", () => {
    expect(messagePreview("image", "casa nova")).toBe("casa nova");
    expect(messagePreview("image", "  ")).toBe("📷 Foto");
    expect(messagePreview("text", "oi")).toBe("oi");
  });

  it("mediaLabel cobre todos os tipos de mídia", () => {
    expect(mediaLabel("video")).toContain("Vídeo");
    expect(mediaLabel("document")).toContain("Documento");
  });

  it("extFromMime mapeia mimes conhecidos e faz fallback pelo subtipo", () => {
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(extFromMime("application/pdf")).toBe("pdf");
    expect(extFromMime("application/x-strange")).toBe("xstrange");
    expect(extFromMime(null)).toBe("bin");
  });

  it("mediaSrc usa URL absoluta direto e caminho de bucket pelo proxy", () => {
    expect(mediaSrc({ mediaUrl: "https://x.com/a.jpg" })).toBe("https://x.com/a.jpg");
    expect(mediaSrc({ mediaUrl: "conv-1/abc.jpg" })).toBe(
      "/api/whatsapp/media?path=conv-1%2Fabc.jpg",
    );
    expect(mediaSrc({ mediaUrl: null })).toBeNull();
  });
});
