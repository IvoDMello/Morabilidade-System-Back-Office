import type { DataSource } from "../types";
import { mockContacts } from "./contacts";
import { mockNotes } from "./notes";
import { mockReminders } from "./reminders";
import { mockTags } from "./tags";
import { mockEvents } from "./events";
import { mockTemplates } from "./templates";
import { mockProperties } from "./properties";
import { mockWhatsapp } from "./whatsapp";
import { mockPushSubscriptions } from "./push-subscriptions";
import { mockCorretores } from "./corretores";
import { mockAgentProposals } from "./agent-proposals";
import { mockAgentRuns } from "./agent-runs";

export const mockDataSource: DataSource = {
  contacts: mockContacts,
  notes: mockNotes,
  reminders: mockReminders,
  tags: mockTags,
  events: mockEvents,
  templates: mockTemplates,
  properties: mockProperties,
  whatsapp: mockWhatsapp,
  pushSubscriptions: mockPushSubscriptions,
  corretores: mockCorretores,
  agentProposals: mockAgentProposals,
  agentRuns: mockAgentRuns,
};
