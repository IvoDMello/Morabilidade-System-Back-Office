import type { Contact } from "@/types/contact";
import type { ContactNote } from "@/types/note";
import type { ContactReminder } from "@/types/reminder";
import type { Tag } from "@/types/tag";
import type { ContactEvent } from "@/types/event";
import type { MessageTemplate } from "@/types/template";
import type { ContactProperty, Property } from "@/types/property";
import type { WhatsAppConversation, WhatsAppMessage } from "@/types/whatsapp";
import type { PushSubscriptionRecord } from "@/types/push";
import type { Corretor } from "@/types/corretor";
import type { AgentProposal } from "@/types/agent-proposal";
import type { AgentRun } from "@/types/agent-run";
import {
  seedContacts,
  seedNotes,
  seedReminders,
  seedTags,
  seedContactTags,
  seedConversations,
  seedMessages,
  seedEvents,
  seedTemplates,
  seedProperties,
  seedContactProperties,
  seedCorretores,
} from "./seed";

/**
 * Estado em memória do modo mock. Persiste apenas durante o processo do
 * servidor de dev (reinicia ao dar `npm run dev` de novo) — suficiente para
 * testar a UI sem depender do Supabase. Ver README para trocar para Supabase.
 */
interface MockStore {
  contacts: Contact[];
  notes: ContactNote[];
  reminders: ContactReminder[];
  tags: Tag[];
  contactTags: { contactId: string; tagId: string }[];
  conversations: WhatsAppConversation[];
  messages: WhatsAppMessage[];
  events: ContactEvent[];
  templates: MessageTemplate[];
  properties: Property[];
  contactProperties: ContactProperty[];
  corretores: Corretor[];
  pushSubscriptions: PushSubscriptionRecord[];
  agentProposals: AgentProposal[];
  agentRuns: AgentRun[];
}

const globalForMockStore = globalThis as unknown as { __mockStore?: MockStore };

export const mockStore: MockStore =
  globalForMockStore.__mockStore ??
  (globalForMockStore.__mockStore = {
    contacts: seedContacts,
    notes: seedNotes,
    reminders: seedReminders,
    tags: seedTags,
    contactTags: seedContactTags,
    conversations: seedConversations,
    messages: seedMessages,
    events: seedEvents,
    templates: seedTemplates,
    properties: seedProperties,
    contactProperties: seedContactProperties,
    corretores: seedCorretores,
    pushSubscriptions: [],
    agentProposals: [],
    agentRuns: [],
  });

export function generateId(): string {
  return crypto.randomUUID();
}
