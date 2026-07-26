import type { CreateNoteInput } from "@/types/note";
import type { ID } from "@/types/common";
import type { DataSource } from "../types";
import { generateId, mockStore } from "./store";

export const mockNotes: DataSource["notes"] = {
  async listByContact(contactId: ID) {
    return mockStore.notes
      .filter((n) => n.contactId === contactId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async create(input: CreateNoteInput) {
    const newNote = {
      id: generateId(),
      contactId: input.contactId,
      note: input.note,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
    mockStore.notes.push(newNote);
    return newNote;
  },
};
