import type { ContactEvent, CreateEventInput } from "@/types/event";
import type { ID } from "@/types/common";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockEvents: DataSource["events"] = {
  async listByContact(contactId: ID) {
    return mockStore.events
      .filter((e) => e.contactId === contactId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async create(input: CreateEventInput) {
    const newEvent: ContactEvent = {
      id: generateId(),
      contactId: input.contactId,
      type: input.type,
      summary: input.summary,
      createdAt: new Date().toISOString(),
    };
    mockStore.events.push(newEvent);
    return newEvent;
  },
};
