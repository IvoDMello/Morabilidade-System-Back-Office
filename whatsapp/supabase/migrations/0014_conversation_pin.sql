-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Fixar conversa no topo da lista (padrão WhatsApp Business). Guardamos o
-- instante em que foi fixada para ordenar as fixadas entre si (mais recente no
-- topo). null = não fixada.
alter table whatsapp_conversations add column if not exists pinned_at timestamptz;

-- A lista ordena "fixadas primeiro, depois por última mensagem"; o índice
-- parcial cobre só as fixadas (poucas), sem pesar na tabela.
create index if not exists whatsapp_conversations_pinned_idx
  on whatsapp_conversations (pinned_at desc) where pinned_at is not null;
