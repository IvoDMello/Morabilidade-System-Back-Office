import type { CreateTemplateInput, MessageTemplate } from "@/types/template";
import type { ID } from "@/types/common";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockTemplates: DataSource["templates"] = {
  async list() {
    return [...mockStore.templates].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  },

  async create(input: CreateTemplateInput) {
    const newTemplate: MessageTemplate = {
      id: generateId(),
      title: input.title.trim(),
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
    };
    mockStore.templates.push(newTemplate);
    return newTemplate;
  },

  async remove(id: ID) {
    mockStore.templates = mockStore.templates.filter((t) => t.id !== id);
  },
};
