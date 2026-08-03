-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- 0023: guarda o ID do evento espelhado na Google Agenda quando o
-- assistente agenda uma visita (ver services/google-calendar.service.ts).
-- Permite apagar o evento junto quando o lembrete é excluído do CRM.
alter table contact_reminders add column if not exists google_calendar_event_id text;
