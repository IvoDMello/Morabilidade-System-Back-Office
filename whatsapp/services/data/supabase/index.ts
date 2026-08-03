import type { DataSource } from "../types";
import { supabaseContacts } from "./contacts";
import { supabaseNotes } from "./notes";
import { supabaseReminders } from "./reminders";
import { supabaseTags } from "./tags";
import { supabaseEvents } from "./events";
import { supabaseTemplates } from "./templates";
import { supabaseProperties } from "./properties";
import { supabaseWhatsapp } from "./whatsapp";
import { supabasePushSubscriptions } from "./push-subscriptions";
import { supabaseCorretores } from "./corretores";
import { supabaseAgentProposals } from "./agent-proposals";
import { supabaseAgentRuns } from "./agent-runs";

export const supabaseDataSource: DataSource = {
  contacts: supabaseContacts,
  notes: supabaseNotes,
  reminders: supabaseReminders,
  tags: supabaseTags,
  events: supabaseEvents,
  templates: supabaseTemplates,
  properties: supabaseProperties,
  whatsapp: supabaseWhatsapp,
  pushSubscriptions: supabasePushSubscriptions,
  corretores: supabaseCorretores,
  agentProposals: supabaseAgentProposals,
  agentRuns: supabaseAgentRuns,
};
