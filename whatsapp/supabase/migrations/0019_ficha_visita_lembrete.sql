-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Bloco "ficha de visita automática": 1h antes da visita agendada, o cron
-- (/api/cron/visita-fichas) gera a ficha na API principal e manda o link — ao
-- cliente, se a janela de 24h da Meta permitir, senão pro número de pendências.
--
-- Três colunas no lembrete, todas opcionais (lembrete comum segue igual):
--   imovel_codigo       de qual imóvel é a visita (sem ele não dá pra gerar ficha)
--   ficha_visita_id     id da ficha já criada na API — não recria a cada rodada
--   ficha_notificada_em marca de envio; é o dedupe que impede reenvio horário

alter table contact_reminders add column if not exists imovel_codigo text;
alter table contact_reminders add column if not exists ficha_visita_id uuid;
alter table contact_reminders add column if not exists ficha_notificada_em timestamptz;

-- O cron varre por janela de horário + pendentes ainda não notificados.
create index if not exists idx_contact_reminders_ficha_pendente
  on contact_reminders (reminder_at)
  where status = 'pendente' and ficha_notificada_em is null;
