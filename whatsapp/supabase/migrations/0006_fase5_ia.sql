-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Painel CRM: Fase 5 do roadmap operacional — resumo de conversa via IA e
-- sugestão de follow-up.

-- Resumo gerado sob demanda (botão "Gerar Resumo") — não é histórico, apenas
-- o último resumo calculado, com o timestamp de quando foi gerado.
alter table contacts add column if not exists ai_summary jsonb;
alter table contacts add column if not exists ai_summary_generated_at timestamptz;
