import { dataSource } from "./data";
import { normalizePhone, phoneMatchCandidates } from "@/lib/phone";
import type { ID } from "@/types/common";
import type {
  ContactFilters,
  CreateContactInput,
  UpdateContactInput,
} from "@/types/contact";

export function getContacts(filters?: ContactFilters) {
  return dataSource.contacts.list(filters);
}

export function getContactById(id: ID) {
  return dataSource.contacts.getById(id);
}

export async function getContactByPhone(phone: string) {
  // Tenta as variantes com/sem o nono dígito — o wa_id da Meta nem sempre
  // vem no mesmo formato em que o contato foi cadastrado.
  for (const candidate of phoneMatchCandidates(phone)) {
    const found = await dataSource.contacts.findByPhone(candidate);
    if (found) return found;
  }
  return null;
}

export function createContact(input: CreateContactInput) {
  return dataSource.contacts.create({ ...input, phone: normalizePhone(input.phone) });
}

export function updateContact(id: ID, input: UpdateContactInput) {
  return dataSource.contacts.update(id, {
    ...input,
    phone: input.phone !== undefined ? normalizePhone(input.phone) : undefined,
  });
}

export function deleteContact(id: ID) {
  return dataSource.contacts.remove(id);
}

export function setContactFavorite(id: ID, isFavorite: boolean) {
  return dataSource.contacts.update(id, { isFavorite });
}

export function setContactBlocked(id: ID, isBlocked: boolean) {
  return dataSource.contacts.update(id, { isBlocked });
}
