import type { ID } from "@/types/common";
import type {
  Contact,
  ContactFilters,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contact";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

function matchesFilters(
  contact: Contact,
  filters: ContactFilters,
  contactIdsWithReminders: Set<string>,
  contactIdsWithProperty: Set<string>,
): boolean {
  if (filters.category && contact.category !== filters.category) return false;
  if (filters.status && contact.status !== filters.status) return false;
  if (filters.nextAction && contact.nextAction !== filters.nextAction) return false;
  if (filters.isFavorite && !contact.isFavorite) return false;
  if (filters.hasReminders && !contactIdsWithReminders.has(contact.id)) return false;
  if (filters.propertyId && !contactIdsWithProperty.has(contact.id)) return false;
  if (filters.search) {
    const search = filters.search.toLowerCase();
    const haystack = `${contact.name} ${contact.phone} ${contact.email ?? ""}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

function assertPhoneAvailable(phone: string, excludeId?: ID) {
  const clash = mockStore.contacts.find((c) => c.phone === phone && c.id !== excludeId);
  if (clash) throw new Error("Já existe um contato com esse telefone.");
}

export const mockContacts: DataSource["contacts"] = {
  async list(filters = {}) {
    const contactIdsWithReminders = new Set(mockStore.reminders.map((r) => r.contactId));
    const contactIdsWithProperty = new Set(
      mockStore.contactProperties
        .filter((cp) => cp.propertyId === filters.propertyId)
        .map((cp) => cp.contactId),
    );
    let results = mockStore.contacts.filter((c) =>
      matchesFilters(c, filters, contactIdsWithReminders, contactIdsWithProperty),
    );

    const sortBy = filters.sortBy ?? "updatedAt";
    const sortDir = filters.sortDir ?? (sortBy === "name" ? "asc" : "desc");
    results = [...results].sort((a, b) => {
      const cmp =
        sortBy === "name"
          ? a.name.localeCompare(b.name)
          : new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return results;
  },

  async getById(id: ID) {
    return mockStore.contacts.find((c) => c.id === id) ?? null;
  },

  async findByPhone(phone: string) {
    return mockStore.contacts.find((c) => c.phone === phone) ?? null;
  },

  async create(input: CreateContactInput) {
    assertPhoneAvailable(input.phone);

    const nowIso = new Date().toISOString();
    const newContact: Contact = {
      id: generateId(),
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      category: input.category,
      status: input.status,
      nextAction: input.nextAction,
      isFavorite: input.isFavorite ?? false,
      isBlocked: input.isBlocked ?? false,
      lossReason: input.lossReason ?? null,
      lossReasonNote: input.lossReasonNote ?? null,
      generalNotes: input.generalNotes ?? null,
      aiSummary: input.aiSummary ?? null,
      aiSummaryGeneratedAt: input.aiSummaryGeneratedAt ?? null,
      clienteId: input.clienteId ?? null,
      clienteCodigo: input.clienteCodigo ?? null,
      corretorId: input.corretorId ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    mockStore.contacts.unshift(newContact);
    return newContact;
  },

  async update(id: ID, input: UpdateContactInput) {
    const index = mockStore.contacts.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Contato não encontrado");

    if (input.phone !== undefined) assertPhoneAvailable(input.phone, id);

    // Patch parcial: chave ausente e chave com `undefined` significam a mesma
    // coisa — "não mexe neste campo". Sem a limpeza, um `{ status }` montado
    // com as demais chaves em `undefined` zerava telefone/categoria no spread
    // abaixo. Limpar aqui vale para todo campo; antes só o e-mail era
    // defendido, um por um. (Apagar de verdade se faz com `null`, como o
    // motivo da perda.)
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as UpdateContactInput;

    const updated: Contact = {
      ...mockStore.contacts[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    mockStore.contacts[index] = updated;
    return updated;
  },

  async remove(id: ID) {
    mockStore.contacts = mockStore.contacts.filter((c) => c.id !== id);
    mockStore.notes = mockStore.notes.filter((n) => n.contactId !== id);
    mockStore.reminders = mockStore.reminders.filter((r) => r.contactId !== id);
    mockStore.contactTags = mockStore.contactTags.filter((ct) => ct.contactId !== id);
    const conversationIds = mockStore.conversations
      .filter((c) => c.contactId === id)
      .map((c) => c.id);
    mockStore.conversations = mockStore.conversations.filter((c) => c.contactId !== id);
    mockStore.messages = mockStore.messages.filter(
      (m) => !conversationIds.includes(m.conversationId),
    );
  },
};
