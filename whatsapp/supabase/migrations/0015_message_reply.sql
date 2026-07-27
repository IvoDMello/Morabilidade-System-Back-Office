-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Responder/citar mensagem (padrão WhatsApp). Guardamos a referência à mensagem
-- citada (reply_to_id) e um SNAPSHOT do trecho/autor, para o balão renderizar a
-- citação sem join e para a citação sobreviver mesmo se a original for apagada.
alter table whatsapp_messages add column if not exists reply_to_id uuid
  references whatsapp_messages (id) on delete set null;
alter table whatsapp_messages add column if not exists reply_to_body text;
alter table whatsapp_messages add column if not exists reply_to_direction text
  check (reply_to_direction in ('inbound', 'outbound'));
