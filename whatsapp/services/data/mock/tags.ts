import type { ID } from "@/types/common";
import type { CreateTagInput, Tag } from "@/types/tag";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockTags: DataSource["tags"] = {
  async list() {
    return [...mockStore.tags].sort((a, b) => a.name.localeCompare(b.name));
  },

  async create(input: CreateTagInput) {
    const existing = mockStore.tags.find(
      (t) => t.name.toLowerCase() === input.name.trim().toLowerCase(),
    );
    if (existing) return existing;

    const newTag: Tag = {
      id: generateId(),
      name: input.name.trim(),
      color: input.color ?? "slate",
      createdAt: new Date().toISOString(),
    };
    mockStore.tags.push(newTag);
    return newTag;
  },

  async listByContact(contactId: ID) {
    const tagIds = new Set(
      mockStore.contactTags.filter((ct) => ct.contactId === contactId).map((ct) => ct.tagId),
    );
    return mockStore.tags.filter((t) => tagIds.has(t.id));
  },

  async addToContact(contactId: ID, tagId: ID) {
    const exists = mockStore.contactTags.some(
      (ct) => ct.contactId === contactId && ct.tagId === tagId,
    );
    if (!exists) mockStore.contactTags.push({ contactId, tagId });
  },

  async removeFromContact(contactId: ID, tagId: ID) {
    mockStore.contactTags = mockStore.contactTags.filter(
      (ct) => !(ct.contactId === contactId && ct.tagId === tagId),
    );
  },
};
