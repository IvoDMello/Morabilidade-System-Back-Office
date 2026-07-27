import type { PropertyStage } from "@/constants/property-stages";
import type {
  ContactPropertyWithDetails,
  CreatePropertyInput,
  Property,
} from "@/types/property";
import type { ID } from "@/types/common";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockProperties: DataSource["properties"] = {
  async list() {
    return [...mockStore.properties].sort((a, b) => a.code.localeCompare(b.code));
  },

  async findByCode(code: string) {
    const normalized = code.trim().toLowerCase();
    return mockStore.properties.find((p) => p.code.toLowerCase() === normalized) ?? null;
  },

  async create(input: CreatePropertyInput) {
    const normalized = input.code.trim().toLowerCase();
    const existing = mockStore.properties.find((p) => p.code.toLowerCase() === normalized);
    if (existing) return existing;

    const newProperty: Property = {
      id: generateId(),
      code: input.code.trim(),
      title: input.title ?? null,
      createdAt: new Date().toISOString(),
    };
    mockStore.properties.push(newProperty);
    return newProperty;
  },

  async listByContact(contactId: ID) {
    return mockStore.contactProperties
      .filter((cp) => cp.contactId === contactId)
      .map((cp): ContactPropertyWithDetails | null => {
        const property = mockStore.properties.find((p) => p.id === cp.propertyId);
        if (!property) return null;
        return { ...cp, code: property.code, title: property.title };
      })
      .filter((cp): cp is ContactPropertyWithDetails => cp !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addToContact(contactId: ID, propertyId: ID, stage: PropertyStage) {
    const existing = mockStore.contactProperties.find(
      (cp) => cp.contactId === contactId && cp.propertyId === propertyId,
    );
    if (existing) return;

    const nowIso = new Date().toISOString();
    mockStore.contactProperties.push({
      contactId,
      propertyId,
      stage,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  },

  async updateStage(contactId: ID, propertyId: ID, stage: PropertyStage) {
    const index = mockStore.contactProperties.findIndex(
      (cp) => cp.contactId === contactId && cp.propertyId === propertyId,
    );
    if (index === -1) return;
    mockStore.contactProperties[index] = {
      ...mockStore.contactProperties[index],
      stage,
      updatedAt: new Date().toISOString(),
    };
  },

  async removeFromContact(contactId: ID, propertyId: ID) {
    mockStore.contactProperties = mockStore.contactProperties.filter(
      (cp) => !(cp.contactId === contactId && cp.propertyId === propertyId),
    );
  },
};
