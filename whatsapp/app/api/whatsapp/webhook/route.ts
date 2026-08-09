import { revalidatePath } from "next/cache";
import { whatsappProvider } from "@/services/whatsapp";
import {
  processEchoMessage,
  processIncomingMessage,
  processStatusUpdate,
} from "@/services/whatsapp.service";
import { analisarConversaDoTelefone } from "@/services/agent-proposals.service";
import { registrarRastroDoTelefone } from "@/services/lead-origem.service";
import { registrarEntregaProblematica } from "@/services/webhook-log.service";
import { classificarRecusa } from "@/lib/webhook-diagnostico";
import { depoisDaResposta } from "@/lib/after-response";
import type { NormalizedWebhookEvent } from "@/services/whatsapp";

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

/** Identificador da mensagem dentro do evento, para o livro de falhas saber
 * QUAL mensagem se perdeu — é o que permite cruzar com o app do celular. */
function wamidDe(evento: NormalizedWebhookEvent): string | null {
  if (evento.type === "message" || evento.type === "echo") {
    return evento.data.waMessageId ?? null;
  }
  return evento.data.waMessageId ?? null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!whatsappProvider.verifyWebhookSignature(rawBody, signature)) {
    // Uma recusa aqui é uma mensagem de cliente que deixa de existir para o
    // sistema: a Meta reentrega algumas vezes e desiste. Registrar o MOTIVO é o
    // que separa "falta uma env" de "o segredo está errado" — problemas com
    // ações completamente diferentes, e antes ambos invisíveis.
    const motivo = classificarRecusa({
      temSegredoConfigurado: Boolean(process.env.WHATSAPP_APP_SECRET),
      cabecalhoAssinatura: signature,
    });
    // `null` = requisição sem assinatura nenhuma, ou seja, não veio da Meta.
    // Varredura de internet não entra no livro (ver webhook-diagnostico.ts).
    if (motivo) await registrarEntregaProblematica({ motivo });

    return new Response("Invalid signature", { status: 401 });
  }

  const events = whatsappProvider.parseWebhookPayload(rawBody);
  const falhas: { evento: NormalizedWebhookEvent; erro: unknown }[] = [];

  for (const event of events) {
    // Cada evento é independente: antes, um erro no primeiro impedia os
    // seguintes de sequer serem tentados, e a reentrega da Meta repetia o
    // mesmo bloqueio. Agora um evento problemático não leva os vizinhos junto.
    try {
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
    } catch (erro) {
      falhas.push({ evento: event, erro });
    }
  }

  revalidatePath("/");
  revalidatePath("/contatos");
  // A visão geral é pré-renderizada: sem estes dois, "Conversas aguardando"
  // ficaria congelada até alguém mexer num contato. Mensagem que chega muda a
  // fila, e a fila é o que essas telas mostram.
  revalidatePath("/dashboard");
  revalidatePath("/pendencias");

  if (falhas.length > 0) {
    await registrarEntregaProblematica({
      motivo: "erro_processamento",
      eventos: events.length,
      processados: events.length - falhas.length,
      wamids: falhas.map((f) => wamidDe(f.evento)).filter((id): id is string => Boolean(id)),
      erro: falhas
        .map((f) => (f.erro instanceof Error ? f.erro.message : String(f.erro)))
        .join(" | ")
        .slice(0, 1000),
    });

    // Devolve erro de propósito: a Meta reentrega, e uma falha passageira
    // (banco instável) se resolve sozinha na próxima tentativa. Responder 200
    // aqui seria dizer "recebi" para uma mensagem que não foi gravada — trocar
    // uma perda visível por uma perda silenciosa.
    return new Response("Processing error", { status: 500 });
  }

  // Responder 200 rápido evita retry-storm da Meta mesmo que algo interno falhe.
  return new Response("OK", { status: 200 });
}
