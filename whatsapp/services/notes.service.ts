import { dataSource } from "./data";
import type { ID } from "@/types/common";
import type { CreateNoteInput } from "@/types/note";

export function getNotesByContact(contactId: ID) {
  return dataSource.notes.listByContact(contactId);
}

export function createNote(input: CreateNoteInput) {
  return dataSource.notes.create(input);
}
