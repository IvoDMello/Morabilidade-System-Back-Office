-- 0024: fecha a leitura anônima das tabelas do CRM.
--
-- Diagnóstico (10/08/2026): a anon key lia contacts, whatsapp_messages,
-- whatsapp_conversations, contact_reminders, contact_events, contact_tags,
-- tags e message_templates no banco de produção.
--
-- Causa: a RLS já estava ligada desde as migrations 0001/0002/0004/0005/0007,
-- mas com as políticas permissivas do projeto original —
--   create policy "Allow all on contacts" on contacts for all using (true)
-- Sem `to authenticated`, valem para o role `public`, então anon passa.
--
-- Por que a 0012 não resolveu: ela dropa apenas a política "auth full access"
-- antes de recriá-la, e nunca as "Allow all on *". Como políticas RLS são
-- permissivas e combinam por OR, a antiga continuava liberando anon mesmo com
-- a nova aplicada — rodar a 0012 de novo não muda nada.
--
-- Esta migration dropa as antigas pelo nome e deixa só a de authenticated.
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
--
-- Webhook e crons não são afetados: rodam no servidor com service_role, que
-- ignora RLS.

set search_path to whatsapp, public;

do $$
declare t text;
begin
  foreach t in array array[
    'contacts', 'contact_tags', 'contact_notes', 'contact_reminders',
    'contact_events', 'contact_properties', 'tags', 'properties',
    'message_templates', 'push_subscriptions',
    'whatsapp_conversations', 'whatsapp_messages'
  ] loop
    -- A permissiva do projeto original, a que de fato abria o banco.
    execute format('drop policy if exists "Allow all on %s" on whatsapp.%I', t, t);

    execute format('alter table whatsapp.%I enable row level security', t);

    execute format('drop policy if exists "auth full access" on whatsapp.%I', t);
    execute format(
      'create policy "auth full access" on whatsapp.%I
         for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
