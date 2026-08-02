import type { ID } from "./common";

export type ContactEventType =
  | "contact_created"
  | "status_changed"
  | "reminder_created"
  | "reminder_completed"
  | "reminder_cancelled"
  | "tag_added"
  | "tag_removed"
  | "property_linked"
  | "property_stage_changed"
  | "property_unlinked"
  | "contact_blocked"
  | "contact_unblocked"
  | "contact_assigned"
  | "property_relation_changed";

/** Log automático de eventos do sistema — resumo curto, sem duplicar conteúdo
 * já guardado em ContactNote/WhatsAppMessage. Ver ActivityFeed. */
export interface ContactEvent {
  id: ID;
  contactId: ID;
  type: ContactEventType;
  summary: string;
  createdAt: string;
}

export interface CreateEventInput {
  contactId: ID;
  type: ContactEventType;
  summary: string;
}
