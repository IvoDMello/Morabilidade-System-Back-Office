-- 0012: RLS em todas as tabelas do CRM (pendência da integração ao monorepo).
--
-- O CRM original não tinha login nem RLS — num Supabase próprio de teste isso
-- passava; no banco PRINCIPAL seria dado de cliente exposto pela anon key.
-- Mesmo modelo das captações (migration 0001 de lá): qualquer usuário
-- AUTENTICADO tem leitura/escrita plena; anon não enxerga nada. Webhook e crons
-- rodam no servidor com service_role, que ignora RLS.

set search_path to whatsapp, public;

alter table contacts               enable row level security;
alter table contact_tags           enable row level security;
alter table contact_notes          enable row level security;
alter table contact_reminders      enable row level security;
alter table contact_events         enable row level security;
alter table contact_properties     enable row level security;
alter table tags                   enable row level security;
alter table properties             enable row level security;
alter table message_templates      enable row level security;
alter table push_subscriptions     enable row level security;
alter table whatsapp_conversations enable row level security;
alter table whatsapp_messages      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'contacts', 'contact_tags', 'contact_notes', 'contact_reminders',
    'contact_events', 'contact_properties', 'tags', 'properties',
    'message_templates', 'push_subscriptions',
    'whatsapp_conversations', 'whatsapp_messages'
  ] loop
    execute format('drop policy if exists "auth full access" on whatsapp.%I', t);
    execute format(
      'create policy "auth full access" on whatsapp.%I
         for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
