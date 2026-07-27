import webpush from "web-push";
import { dataSource } from "./data";
import type { CreatePushSubscriptionInput } from "@/types/push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();

// A Apple rejeita (403 "BadJwtToken") o VAPID subject se não for um mailto:
// ou https: com domínio real — nada de ".local"/"localhost". Ajuste aqui se o
// domínio de produção mudar (domínio próprio, etc.).
const vapidSubject = "https://painel-crm-seven.vercel.app";

let vapidReady = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidReady = true;
  } catch (error) {
    // Chave VAPID malformada não deve derrubar o build/servidor — só desativa o push.
    console.error("Chaves VAPID inválidas, notificações push desativadas:", error);
  }
}

export const isPushConfigured = vapidReady;

export async function subscribeToPush(input: CreatePushSubscriptionInput) {
  return dataSource.pushSubscriptions.upsert(input);
}

export async function unsubscribeFromPush(endpoint: string) {
  await dataSource.pushSubscriptions.remove(endpoint);
}

interface NewMessagePushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushSendResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

/** Dispara notificação para todos os dispositivos inscritos (sem bloquear o fluxo de mensagens em caso de falha). */
export async function notifyNewMessage(payload: NewMessagePushPayload): Promise<PushSendResult[]> {
  if (!isPushConfigured) {
    return [{ endpoint: "-", success: false, error: "Chaves VAPID não configuradas no servidor." }];
  }

  const subscriptions = await dataSource.pushSubscriptions.list();
  if (subscriptions.length === 0) {
    return [{ endpoint: "-", success: false, error: "Nenhuma inscrição encontrada no banco." }];
  }

  return Promise.all(
    subscriptions.map(async (sub): Promise<PushSendResult> => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        return { endpoint: sub.endpoint, success: true };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const message = error instanceof Error ? error.message : String(error);
        if (statusCode === 404 || statusCode === 410) {
          await dataSource.pushSubscriptions.remove(sub.endpoint);
        } else {
          console.error("Erro ao enviar notificação push:", error);
        }
        return { endpoint: sub.endpoint, success: false, statusCode, error: message };
      }
    }),
  );
}
