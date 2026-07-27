-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Fase 6 (inbox WhatsApp): bloqueio de contato + listas padrão do filtro de
-- conversas. As "listas" são as mesmas etiquetas (tags) já usadas nos contatos.

alter table contacts add column if not exists is_blocked boolean not null default false;

-- Bloqueio/desbloqueio entram na timeline do contato.
alter table contact_events drop constraint if exists contact_events_type_check;
alter table contact_events add constraint contact_events_type_check check (
  type in (
    'contact_created', 'status_changed', 'reminder_created', 'reminder_completed',
    'reminder_cancelled', 'tag_added', 'tag_removed',
    'property_linked', 'property_stage_changed', 'property_unlinked',
    'contact_blocked', 'contact_unblocked'
  )
);

-- Listas padrão da operação — só insere as que ainda não existem (o índice
-- único é por lower(name), então a comparação ignora maiúsculas).
insert into tags (name, color)
select v.name, v.color
from (values
  ('Proprietários', 'slate'),
  ('Corretores', 'blue'),
  ('Pós venda', 'emerald'),
  ('Locatário', 'amber'),
  ('Captação', 'pink'),
  ('Singularidade', 'violet'),
  ('Morabilidade', 'emerald'),
  ('Investidor', 'blue')
) as v(name, color)
where not exists (select 1 from tags t where lower(t.name) = lower(v.name));
