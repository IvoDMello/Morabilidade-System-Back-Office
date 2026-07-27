import type { ID } from "./common";

/** Anotações são um histórico imutável: sempre inseridas, nunca editadas ou removidas. */
export interface ContactNote {
  id: ID;
  contactId: ID;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateNoteInput {
  contactId: ID;
  note: string;
  createdBy: string;
}
