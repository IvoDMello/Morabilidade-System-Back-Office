import { dataSource } from "./data";
import { normalizePhone, phoneMatchCandidates } from "@/lib/phone";
import { fetchClienteByTelefone, isBackofficeConfigured } from "@/lib/backoffice-api";
import type { ID } from "@/types/common";
import type {
  Contact,
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

/**
 * Casa o contato com um cliente real do sistema por telefone, se ainda não
 * estiver vinculado. Best-effort e idempotente: só tenta quando a integração
 * está configurada e `clienteId` é null; qualquer falha na API é engolida e o
 * contato segue sem vínculo. Persiste o vínculo (id + snapshot do código) quando
 * encontra, e devolve o contato possivelmente atualizado.
 */
export async function ensureClienteVinculo(contact: Contact): Promise<Contact> {
  if (contact.clienteId || !isBackofficeConfigured()) return contact;

  let cliente;
  try {
    cliente = await fetchClienteByTelefone(contact.phone);
  } catch {
    return contact;
  }
  if (!cliente) return contact;

  try {
    return await dataSource.contacts.update(contact.id, {
      clienteId: cliente.id,
      clienteCodigo: cliente.codigo,
    });
  } catch {
    // O vínculo é conveniência; se a escrita falhar, não atrapalha a ficha.
    return { ...contact, clienteId: cliente.id, clienteCodigo: cliente.codigo };
  }
}
