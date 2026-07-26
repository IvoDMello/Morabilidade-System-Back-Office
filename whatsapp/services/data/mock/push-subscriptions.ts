import type { CreatePushSubscriptionInput } from "@/types/push";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockPushSubscriptions: DataSource["pushSubscriptions"] = {
  async list() {
    return [...mockStore.pushSubscriptions];
  },

  async upsert(input: CreatePushSubscriptionInput) {
    const existing = mockStore.pushSubscriptions.find((s) => s.endpoint === input.endpoint);
    if (existing) {
      existing.p256dh = input.keys.p256dh;
      existing.auth = input.keys.auth;
      return existing;
    }

    const created = {
      id: generateId(),
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      createdAt: new Date().toISOString(),
    };
    mockStore.pushSubscriptions.push(created);
    return created;
  },

  async remove(endpoint: string) {
    mockStore.pushSubscriptions = mockStore.pushSubscriptions.filter(
      (s) => s.endpoint !== endpoint,
    );
  },
};
