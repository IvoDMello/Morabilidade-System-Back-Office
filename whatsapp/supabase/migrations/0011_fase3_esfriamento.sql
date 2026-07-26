-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 3 do roadmap de follow-up — jobs de esfriamento e alerta.

alter table whatsapp_conversations
  add column if not exists last_alert_at timestamptz;
