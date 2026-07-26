"use server";

import { subscribeToPush, unsubscribeFromPush } from "@/services/push.service";
import type { CreatePushSubscriptionInput } from "@/types/push";

export async function subscribeUserAction(input: CreatePushSubscriptionInput) {
  await subscribeToPush(input);
}

export async function unsubscribeUserAction(endpoint: string) {
  await unsubscribeFromPush(endpoint);
}
