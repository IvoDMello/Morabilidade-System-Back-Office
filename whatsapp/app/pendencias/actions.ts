"use server";

import { revalidatePath } from "next/cache";
import { closeConversation, snoozeFollowUp } from "@/services/whatsapp.service";
import type { ID } from "@/types/common";

export async function closeConversationAction(conversationId: ID) {
  await closeConversation(conversationId);
  revalidatePath("/pendencias");
  revalidatePath("/");
}

export async function snoozeFollowUpAction(conversationId: ID) {
  await snoozeFollowUp(conversationId, 1);
  revalidatePath("/pendencias");
}
