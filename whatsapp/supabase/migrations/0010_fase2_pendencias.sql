-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 2 do roadmap de follow-up — suporte a "adiar follow-up".

alter table whatsapp_conversations
  add column if not exists follow_up_snoozed_until timestamptz;

-- Qualquer mensagem nova (do cliente ou minha) cancela um adiamento pendente,
-- já que a conversa voltou a ter atividade.
create or replace function sync_conversation_status_on_message()
returns trigger as $$
begin
  if new.direction = 'inbound' then
    update whatsapp_conversations
    set
      last_inbound_at = new.wa_timestamp,
      status = 'aguardando_resposta',
      follow_up_snoozed_until = null,
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
      follow_up_snoozed_until = null,
      status_changed_at = case
        when status <> 'respondida' then now()
        else status_changed_at
      end
    where id = new.conversation_id;
  end if;
  return new;
end;
$$ language plpgsql;
