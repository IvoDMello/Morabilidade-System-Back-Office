import { revalidatePath } from "next/cache";
import { whatsappProvider } from "@/services/whatsapp";
import {
  processEchoMessage,
  processIncomingMessage,
  processStatusUpdate,
} from "@/services/whatsapp.service";

/** Handshake de verificação exigido pela Meta ao configurar o webhook. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = whatsappProvider.verifyWebhookHandshake({
    mode: searchParams.get("hub.mode"),
    token: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge"),
  });

  if (result === null) return new Response("Forbidden", { status: 403 });
  return new Response(result, { status: 200 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!whatsappProvider.verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const events = whatsappProvider.parseWebhookPayload(rawBody);
  for (const event of events) {
    if (event.type === "message") {
      await processIncomingMessage(event.data);
    } else if (event.type === "echo") {
      await processEchoMessage(event.data);
    } else {
      await processStatusUpdate(event.data);
    }
  }

  revalidatePath("/");
  revalidatePath("/contatos");

  // Responder 200 rápido evita retry-storm da Meta mesmo que algo interno falhe.
  return new Response("OK", { status: 200 });
}
