import { revalidatePath } from "next/cache";
import { whatsappProvider } from "@/services/whatsapp";
import {
  processEchoMessage,
  processIncomingMessage,
  processStatusUpdate,
} from "@/services/whatsapp.service";
import { analisarConversaDoTelefone } from "@/services/agent-proposals.service";
import { registrarRastroDoTelefone } from "@/services/lead-origem.service";
import { depoisDaResposta } from "@/lib/after-response";

/** A análise do copiloto roda depois da resposta (ver `depoisDaResposta`), mas
 * ainda dentro desta invocação — o teto precisa cobrir uma chamada de modelo
 * sobre o histórico da conversa. */
export const maxDuration = 60;

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
      const gravada = await processIncomingMessage(event.data);
      const { fromPhone } = event.data;

      // O rastro que a própria mensagem carrega: código de imóvel do botão do
      // site vira vínculo e origem do lead. Vem antes da análise porque é
      // barato, determinístico e enriquece o contexto que ela vai ler.
      depoisDaResposta(() => registrarRastroDoTelefone(fromPhone, event.data.body));

      // Nível 1 — o agente chega antes do humano: a análise dispara agora, e o
      // rascunho já espera pronto quando alguém abrir a conversa. Fora do
      // caminho da resposta, senão a Meta reentrega por timeout. O dedupe por
      // mensagem vive no service, então uma reentrega não analisa duas vezes.
      depoisDaResposta(() => analisarConversaDoTelefone(fromPhone, gravada.id));
    } else if (event.type === "echo") {
      await processEchoMessage(event.data);
    } else {
      await processStatusUpdate(event.data);
    }
  }

  revalidatePath("/");
  revalidatePath("/contatos");
  // A visão geral é pré-renderizada: sem estes dois, "Conversas aguardando"
  // ficaria congelada até alguém mexer num contato. Mensagem que chega muda a
  // fila, e a fila é o que essas telas mostram.
  revalidatePath("/dashboard");
  revalidatePath("/pendencias");

  // Responder 200 rápido evita retry-storm da Meta mesmo que algo interno falhe.
  return new Response("OK", { status: 200 });
}
