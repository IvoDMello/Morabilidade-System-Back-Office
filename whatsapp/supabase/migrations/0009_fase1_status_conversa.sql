-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 1 do roadmap de follow-up — estado de conversa.

create type conversation_status as enum (
  'aguardando_resposta',
  'respondida',
  'follow_up_sugerido',
  'encerrada'
);

alter table whatsapp_conversations
  add column if not exists status conversation_status not null default 'aguardando_resposta',
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists status_changed_at timestamptz not null default now();

-- Backfill: usa o histórico real de mensagens para preencher last_inbound_at/
-- last_outbound_at das conversas já existentes.
update whatsapp_conversations c
set
  last_inbound_at = (
    select max(m.wa_timestamp) from whatsapp_messages m
    where m.conversation_id = c.id and m.direction = 'inbound'
  ),
  last_outbound_at = (
    select max(m.wa_timestamp) from whatsapp_messages m
    where m.conversation_id = c.id and m.direction = 'outbound'
  );

update whatsapp_conversations
set status = case
  when last_message_direction = 'outbound' then 'respondida'::conversation_status
  else 'aguardando_resposta'::conversation_status
end,
status_changed_at = coalesce(last_message_at, now())
where last_message_direction is not null;

-- Trigger: cada mensagem inserida atualiza o estado da conversa.
create or replace function sync_conversation_status_on_message()
returns trigger as $$
begin
  if new.direction = 'inbound' then
    update whatsapp_conversations
    set
      last_inbound_at = new.wa_timestamp,
      status = 'aguardando_resposta',
      status_changed_at = case
        when status <> 'aguardando_resposta' then now()
        else status_changed_at
      end
    where id = new.conversation_id;
  else
    update whatsapp_conversations
    set
      last_outbound_at = new.wa_timestamp,
      status = 'respondida',
      status_changed_at = case
        when status <> 'respondida' then now()
        else status_changed_at
      end
    where id = new.conversation_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_conversation_status on whatsapp_messages;
create trigger trg_sync_conversation_status
  after insert on whatsapp_messages
  for each row execute function sync_conversation_status_on_message();
